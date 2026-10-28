#!/usr/bin/env python3
"""Build the bundled Highschool Runtime paper library.

Sources (development-time, not shipped):
  * .tmp/gaokao      -> rainewhk/gaokao public Gaokao question dataset (Apache-2.0)
  * .tmp/mathpdfs    -> deekur/gaokaomath public Gaokao math paper PDFs

The generated markdown is what ships with the app. It is loaded automatically;
there is no user-facing import step.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
import re
import shutil
import unicodedata
import urllib.request
from collections import defaultdict
from pathlib import Path

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / '.tmp'
DATASET = RAW / 'gaokao' / 'dataset'
PDF_DIR = RAW / 'mathpdfs'
OUT = ROOT / 'src' / 'data' / 'papers'
PUBLIC = ROOT / 'public'
FIGURE_DIR = PUBLIC / 'paper-assets' / 'figures'
MATH_IMAGE_DIR = PUBLIC / 'paper-assets' / 'math'

SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
SUBJECT_ORDER = {s: i for i, s in enumerate(SUBJECTS)}

# Public question banks usually carry the original per-question point values of
# a whole paper but only expose part of its questions. Keep the original values
# so a paper reads like a real paper instead of every question being worth an
# odd decimal; only scale down when the source pool adds up past the real
# full mark (it sometimes merges several papers of the same year).
TARGET_TOTAL = {
    '语文': 150, '数学': 150, '英语': 150,
    '物理': 100, '化学': 100, '生物': 100,
    '政治': 100, '历史': 100, '地理': 100,
}
TARGET_DURATION = {
    '语文': 150, '数学': 120, '英语': 100,
    '物理': 75, '化学': 75, '生物': 75,
    '政治': 75, '历史': 75, '地理': 75,
}


def cap_scores(meta_questions, target):
    """Keep original points, scaling down only when the pool exceeds the mark."""
    total = sum(q['score'] for q in meta_questions)
    if total > target:
        return normalise_scores(meta_questions, target)
    return round(total, 1)


def scaled_duration(subject, total):
    base = TARGET_DURATION.get(subject, 120)
    target = TARGET_TOTAL.get(subject, 150)
    minutes = int(round(base * total / target / 5.0)) * 5
    return max(30, min(base, minutes))


def normalise_scores(meta_questions, target):
    """Scale question points to `target`, keeping one-decimal precision."""
    total = sum(q['score'] for q in meta_questions)
    if not meta_questions or total <= 0:
        return 0.0
    for q in meta_questions:
        q['score'] = round(q['score'] * target / total, 1)
    diff = round(target - sum(q['score'] for q in meta_questions), 1)
    if meta_questions and diff:
        last = meta_questions[-1]
        last['score'] = round(max(0.5, last['score'] + diff), 1)
    return round(sum(q['score'] for q in meta_questions), 1)

SUBJECT_ALIAS = {'思想政治': '政治'}
KIND_REAL = 'real'
KIND_MOCK = 'mock'

DATASET_SOURCE = {
    'name': 'GAOKAO-Bench 公开真题集',
    'url': 'https://github.com/rainewhk/gaokao',
    'note': '由公开高考真题整理，依据 Apache-2.0 许可使用；部分题型从略。'
}
MATH_SOURCE = {
    'name': '公开高考数学真题汇编',
    'url': 'https://github.com/deekur/gaokaomath',
    'note': '按公开真题 PDF 整理。原卷未附答案的题目按自评计分。'
}

CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五']


def norm_space(s: str) -> str:
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


def clean_md_text(s: str) -> str:
    """Keep markdown/LaTeX from the dataset intact, but remove control chars."""
    s = s.replace('\u0000', '')
    s = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f]', '', s)
    return norm_space(s)


def slug(text: str) -> str:
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'[^\w\u4e00-\u9fff-]+', '-', text)
    return re.sub(r'-+', '-', text).strip('-')


def qid(prefix: str, idx: int) -> str:
    return f'{prefix}-q{idx:02d}'


def md_hardbreak(text: str) -> str:
    """Preserve source line breaks without turning the whole paper into one paragraph."""
    lines = text.split('\n')
    out = []
    for line in lines:
        if line.strip() == '':
            out.append('')
        else:
            out.append(line.rstrip() + '  ')
    return '\n'.join(out).strip()


TABULAR_RE = re.compile(
    r'\\begin\{tabular\}\{(?:[^{}]|\{[^{}]*\})*\}(.*?)\\end\{tabular\}', re.S)
MULTICOLUMN_RE = re.compile(
    r'\\multicolumn\{\d+\}\{(?:[^{}]|\{[^{}]*\})*\}\{((?:[^{}]|\{[^{}]*\})*)\}', re.S)
MULTIROW_RE = re.compile(
    r'\\multirow\{\d+\}\{(?:[^{}]|\{[^{}]*\})*\}\{((?:[^{}]|\{[^{}]*\})*)\}', re.S)
CLINE_RE = re.compile(r'\\cline\{[^}]*\}')
MATH_SPAN_RE = re.compile(r'\$([^$]+)\$', re.S)
FIGURE_RE = re.compile(r'!\[([^\]]*)\]\((https?://[^)\s]+)\)')


SUPERSCRIPT_MAP = str.maketrans('0123456789+-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻')
SUBSCRIPT_MAP = str.maketrans('0123456789+-', '₀₁₂₃₄₅₆₇₈₉₊₋')
ARRAY_MATH_RE = re.compile(
    r'\$\s*\\begin\{array\}\{[^{}]*\}(.*?)\\end\{array\}\s*\$', re.S)


def split_top_level(text: str, sep: str) -> list[str]:
    """Split on sep while ignoring inline maths and nested LaTeX environments."""
    parts, buf = [], []
    depth = 0
    in_math = False
    i = 0
    while i < len(text):
        if text.startswith('\\begin{', i):
            depth += 1
        elif text.startswith('\\end{', i) and depth:
            depth -= 1
        char = text[i]
        if char == '$' and (i == 0 or text[i - 1] != '\\'):
            in_math = not in_math
        if not in_math and depth == 0 and text.startswith(sep, i):
            parts.append(''.join(buf))
            buf = []
            i += len(sep)
            continue
        buf.append(char)
        i += 1
    parts.append(''.join(buf))
    return parts


def flatten_array_math(cell: str) -> str:
    """Arrays inside table cells only exist to fake line breaks; unwrap them."""
    def repl(match: re.Match) -> str:
        pieces = []
        for row in split_top_level(match.group(1), '\\\\'):
            for part in split_top_level(row, '&'):
                if part.strip():
                    pieces.append(part.strip())
        text = ' '.join(pieces)
        text = re.sub(
            r'\\(?:text|mathrm|textrm|mathbf|textit)\s*\{([^{}]*)\}', r'\1', text)
        text = text.replace('\\cdot', '·').replace('\\%', '%').replace('~', ' ')
        text = re.sub(r'\\(?:left|right)\.?', '', text)
        text = re.sub(r'\\[,;:! ]', ' ', text)
        text = re.sub(r'\^\{([0-9+\-]+)\}', lambda m: m.group(1).translate(SUPERSCRIPT_MAP), text)
        text = re.sub(r'_\{([0-9+\-]+)\}', lambda m: m.group(1).translate(SUBSCRIPT_MAP), text)
        text = re.sub(r'\^([0-9+\-])', lambda m: m.group(1).translate(SUPERSCRIPT_MAP), text)
        text = re.sub(r'_([0-9+\-])', lambda m: m.group(1).translate(SUBSCRIPT_MAP), text)
        text = text.replace('{', '').replace('}', '')
        return re.sub(r'\s+', ' ', text).strip()

    return ARRAY_MATH_RE.sub(repl, cell)


def clean_table_cell(cell: str) -> str:
    """Flatten spanning/rule commands that Markdown tables cannot express."""
    for _ in range(3):
        stripped = MULTICOLUMN_RE.sub(r'\1', cell)
        stripped = MULTIROW_RE.sub(r'\1', stripped)
        if stripped == cell:
            break
        cell = stripped
    cell = CLINE_RE.sub('', cell)
    for command in ('\\hline', '\\toprule', '\\midrule', '\\bottomrule'):
        cell = cell.replace(command, '')
    return flatten_array_math(cell).strip()


def tabular_to_markdown(match: re.Match) -> str:
    """KaTeX cannot render tabular, so turn simple tables into Markdown tables."""
    rows = []
    for raw in split_top_level(match.group(1), '\\\\'):
        raw = CLINE_RE.sub('', raw).replace('\\hline', '').strip()
        if not raw:
            continue
        cells = [clean_table_cell(cell).replace('|', '\\|')
                 for cell in split_top_level(raw, '&')]
        rows.append(cells)
    if not rows:
        return ''
    width = max(len(row) for row in rows)
    rows = [row + [''] * (width - len(row)) for row in rows]
    if any(not any(row) for row in rows):
        rows = [row for row in rows if any(row)]
    if not rows:
        return ''
    keep = [i for i in range(width) if any(row[i] for row in rows)]
    rows = [[row[i] for i in keep] for row in rows]
    width = len(keep)
    lines = [
        '| ' + ' | '.join(rows[0]) + ' |',
        '| ' + ' | '.join(['---'] * width) + ' |',
    ]
    lines.extend('| ' + ' | '.join(row) + ' |' for row in rows[1:])
    return '\n\n' + '\n'.join(lines) + '\n\n'


def join_math_lines(text: str) -> str:
    """Inline math must stay on one line for remark-math to pick it up."""
    def repl(match: re.Match) -> str:
        inner = match.group(1)
        if '\n' not in inner:
            return match.group(0)
        return '$' + re.sub(r'\s*\n\s*', ' ', inner).strip() + '$'

    return MATH_SPAN_RE.sub(repl, text)


def localise_figures(text: str) -> str:
    """Download remote figures once and reference the bundled copy from the paper."""
    def repl(match: re.Match) -> str:
        alt, url = match.group(1), match.group(2)
        if 'mathpix' not in url and 'cdn.' not in url:
            return match.group(0)
        digest = hashlib.sha1(url.encode('utf-8')).hexdigest()[:20]
        name = f'{digest}.jpg'
        dest = FIGURE_DIR / name
        if not dest.exists():
            FIGURE_DIR.mkdir(parents=True, exist_ok=True)
            try:
                with urllib.request.urlopen(url, timeout=20) as response:
                    dest.write_bytes(response.read())
            except Exception as exc:
                print('figure download failed', url[:80], exc)
                return match.group(0)
        return f'![{alt}](./paper-assets/figures/{name})'

    return FIGURE_RE.sub(repl, text)


def strip_question_prefix(text: str) -> str:
    """Remove the bank's own numbering and point tag; the paper supplies both."""
    text = text.lstrip()
    text = re.sub(r'^\d{1,2}\s*[.．、]\s*', '', text)
    text = re.sub(r'^[（(]\s*\d+(?:\.\d+)?\s*分\s*[)）]\s*', '', text)
    text = re.sub(r'^\d+(?:\.\d+)?\s*分\s*[)）]\s*', '', text)
    return text.lstrip()


# The bank wraps prices as $€ 7.50$ inside English tables. Those delimiters are
# TeX leftovers, not maths, so drop them and keep the currency visible.
CURRENCY_MATH_RE = re.compile(r'\$\s*([€£¥])\s*([\d][\d.,]*)\s*\$')

# Tables that print their rows as options leave the bank's parser with
# "A. A", "B. $B$" or "C. $\mathrm{C}$" placeholders; drop lines whose content
# is only the option letter itself.
PLACEHOLDER_OPTION_RE = re.compile(
    r'(?m)^[ \t]*([A-H])[.．、][ \t]*(\S(?:.*\S)?)[ \t]*$')


def drop_placeholder_options(text: str) -> str:
    def repl(match: re.Match) -> str:
        body = re.sub(r'\\mathrm\s*\{\s*([A-Za-z])\s*\}', r'\1', match.group(2))
        body = body.replace('$', '').strip()
        return '' if body == match.group(1) else match.group(0)

    text = PLACEHOLDER_OPTION_RE.sub(repl, text)
    return re.sub(r'\n{3,}', '\n\n', text)


def prepare_text(text: str, subject: str) -> str:
    text = localise_figures(text)
    text = TABULAR_RE.sub(tabular_to_markdown, text)
    text = drop_placeholder_options(text)
    if subject == '英语':
        # English passages use "$" for prices; there is no maths to protect.
        text = CURRENCY_MATH_RE.sub(r'\1\2', text)
        return text.replace('$', '\\$')
    text = join_math_lines(text)
    return text


def json_answer(raw):
    if isinstance(raw, list):
        return raw
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith('['):
            try:
                value = json.loads(s)
                if isinstance(value, list):
                    return [str(x) for x in value]
            except Exception:
                pass
        if ';' in s or '；' in s:
            return [x.strip() for x in re.split(r'[;；]', s) if x.strip()]
        return [s] if s else []
    return [str(raw)]


OPTION_RE = re.compile(r'(?m)(?:^|[\t ])([A-H])[.．、]\s*')
NUMBER_LINE_RE = re.compile(r'^(\s*)(\d{1,2})[.．、]\s*(.*)$')


def has_options(text: str) -> bool:
    found = {m.group(1) for m in OPTION_RE.finditer(text)}
    return len(found) >= 2


def split_numbered(text: str):
    """Split a passage that contains numbered sub-questions.

    Returns (intro, [(number, content), ...]) when at least two sequential
    question numbers are present, otherwise (text, []).
    """
    lines = text.split('\n')
    marks = []
    for i, line in enumerate(lines):
        m = NUMBER_LINE_RE.match(line)
        if not m:
            continue
        n = int(m.group(2))
        if 1 <= n <= 40:
            marks.append((i, n, m.group(3)))
    if len(marks) < 2:
        return text, []
    # Require the numbers to be reasonably sequential (1,2,3 or 14,15,16...).
    nums = [m[1] for m in marks]
    if not all(0 <= b - a <= 3 for a, b in zip(nums, nums[1:])):
        return text, []
    # A passage usually precedes the first numbered line.
    intro = '\n'.join(lines[:marks[0][0]]).strip()
    parts = []
    for j, (line_idx, n, first_line) in enumerate(marks):
        end = marks[j + 1][0] if j + 1 < len(marks) else len(lines)
        body = '\n'.join([first_line] + lines[line_idx + 1:end]).strip()
        parts.append((n, body))
    return intro, parts


def classify(answer_list, question_text: str, is_sub: bool = False):
    letters = []
    for a in answer_list:
        a = str(a).strip()
        if re.fullmatch(r'[A-H]{1,8}', a, flags=re.I):
            letters.extend(list(a.upper()))
    if letters and has_options(question_text):
        # A 20-blank cloze or a five-answer matching task is one passage-level
        # row, not a multi-select question. Asking the student to tick A-H once
        # would be impossible, so keep it as a self-checked reference item.
        if len(answer_list) > 4 or len(letters) > 4:
            return 'essay', ' / '.join(f'{i + 1}. {a}' for i, a in enumerate(answer_list)), False
        unique = sorted(set(letters))
        return ('multiple' if len(unique) > 1 else 'single'), ''.join(unique), True
    if answer_list and all(re.fullmatch(r'[A-H]{1,8}', str(a).strip(), flags=re.I) for a in answer_list):
        return 'fill', '|'.join(str(a).strip().upper() for a in answer_list), True
    # Text answers are reviewed by the student.
    if any(tok in question_text for tok in ['作文', '写作', '论述', '分析', '说明理由', '谈谈你的看法', '写一段']):
        return 'essay', ' / '.join(str(a) for a in answer_list), False
    return 'solution', ' / '.join(str(a) for a in answer_list), False


def question_block(number: int, qtype: str, score: float, answer: str, content: str,
                   analysis: str = '', grading: bool = True) -> str:
    return (
        f'### 第 {number} 题\n\n'
        f'{md_hardbreak(content)}\n'
    )


def paper_markdown(meta: dict, sections: list[dict]) -> str:
    front = yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=1000)
    body = [f'# {meta["title"]}', '']
    note = meta.get('note', '')
    if note:
        body.extend([f'> {note}', ''])
    for sec in sections:
        body.append(f'## {sec["title"]}')
        body.append('')
        if sec.get('intro'):
            body.append(md_hardbreak(sec['intro']))
            body.append('')
        for q in sec['questions']:
            body.append(f'### 第 {q["number"]} 题')
            body.append('')
            body.append(md_hardbreak(q['content']))
            body.append('')
    return f'---\n{front}---\n\n' + '\n'.join(body).strip() + '\n'


def paper_meta(pid, title, subject, region, year, kind, duration, total_score,
               source, note, fmt='selection', tags=None, questions=None):
    return {
        'id': pid,
        'title': title,
        'subject': subject,
        'region': region,
        'year': year,
        'kind': kind,
        'format': fmt,
        'duration': duration,
        'totalScore': total_score,
        'sourceName': source['name'],
        'sourceUrl': source['url'],
        'sourceNote': source['note'],
        'note': note,
        'tags': tags or [],
        'questions': questions or []
    }


# ---------------------------------------------------------------------------
# Public dataset -> real selection papers + recombined mock papers
# ---------------------------------------------------------------------------

def load_dataset_rows():
    groups = defaultdict(list)
    if not DATASET.exists():
        return groups
    for path in DATASET.glob('*/*/*/*.jsonl'):
        subject = SUBJECT_ALIAS.get(path.parts[-4], path.parts[-4])
        year = path.parts[-3]
        paper_type = path.parts[-2]
        question_type = path.stem
        if subject not in SUBJECTS:
            continue
        try:
            for line in path.read_text(encoding='utf-8').splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                row['_subject'] = subject
                row['_year'] = int(year)
                row['_paper_type'] = paper_type
                row['_question_type'] = question_type
                row['_source_file'] = str(path)
                groups[(subject, int(year))].append(row)
        except Exception as exc:
            print('skip', path, exc)
    return groups


def rows_for_type(rows, paper_type):
    return [r for r in rows if r['_paper_type'] == paper_type]


def build_selection_paper(subject, year, paper_type, rows, out_path):
    """Build a readable paper from all questions of one real paper type."""
    # Group by question type, preserving a sensible order.
    order = ['选择题', '单选题', '多选题', '填空题', '阅读理解', '完形填空',
             '现代文阅读', '文言文阅读', '古代诗歌阅读', '名篇名句默写',
             '文学类文本阅读', '实用类文本阅读', '解答题', '非选择题',
             '短文改错', '写作']
    grouped = defaultdict(list)
    for row in rows:
        grouped[row['_question_type']].append(row)
    ordered_types = sorted(grouped, key=lambda t: order.index(t) if t in order else 99)

    sections = []
    meta_questions = []
    qnum = 0
    material_no = 0
    seen_numbers = defaultdict(set)

    def add_question(qtype, content, answer_list, score, analysis, part_is_sub=False):
        nonlocal qnum
        qnum += 1
        raw = strip_question_prefix(content)
        # Classify against the raw text: its option letters are reliable even
        # when prepare_text later drops placeholder lines for table options.
        qtype_x, ans, grading = classify(answer_list, raw, part_is_sub)
        content = prepare_text(raw, subject)
        meta_questions.append({
            'id': qid(f'{subject}-{year}', qnum),
            'number': qnum,
            'type': qtype_x,
            'score': score,
            'answer': prepare_text(ans, subject),
            'grading': 'auto' if grading else 'self',
            'analysis': prepare_text(analysis, subject),
            'section': qtype,
        })
        return {'number': qnum, 'content': content}

    for qtype in ordered_types:
        group_section = {'title': qtype, 'questions': []}
        for row in grouped[qtype]:
            qtext = clean_md_text(row.get('question', ''))
            if not qtext:
                continue
            # A year folder can merge several papers (e.g. 全国 I / II). Keep one
            # question per printed number so the excerpt has a paper-like length
            # instead of every question appearing twice.
            lead = re.match(r'^\s*(\d{1,2})[.．、](?!\d)', qtext)
            if lead:
                number = int(lead.group(1))
                if 1 <= number <= 40:
                    if number in seen_numbers[qtype]:
                        continue
                    seen_numbers[qtype].add(number)
            intro, parts = split_numbered(qtext)
            answers = json_answer(row.get('answer'))
            score = float(row.get('score') or 5)
            if score <= 0:
                score = 5.0
            analysis = clean_md_text(row.get('analysis', '') or '')

            if parts and len(answers) == len(parts):
                part_questions = [
                    add_question(qtype, part, [answers[pi]], score, analysis, True)
                    for pi, (_n, part) in enumerate(parts)
                ]
                if intro:
                    # Keep a long reading passage once at the top of its own
                    # section instead of repeating it before every sub-question.
                    material_no += 1
                    sections.append({
                        'title': f'{qtype} · 材料 {material_no}',
                        'intro': prepare_text(intro, subject),
                        'questions': part_questions,
                    })
                else:
                    group_section['questions'].extend(part_questions)
            else:
                group_section['questions'].append(
                    add_question(qtype, qtext, answers, score, analysis, False)
                )
        if group_section['questions']:
            sections.append(group_section)

    if qnum < 5:
        return False

    sections = [s for s in sections if s['questions']]
    if not sections:
        return False

    target = TARGET_TOTAL.get(subject, 150)
    total_score = cap_scores(meta_questions, target)
    pid = f'real-cn-{slug(subject)}-{year}-{slug(paper_type)}'
    title = f'{year} 年高考{subject}真题选编 · {paper_type}'
    note = ('依据公开全国卷真题整理，按题型分节呈现；'
            '分值为原题分值，题量以公开真题为准，部分题型从略。')
    meta = paper_meta(
        pid, title, subject, '全国', year, KIND_REAL,
        duration=scaled_duration(subject, total_score),
        total_score=total_score,
        source=DATASET_SOURCE, note=note, fmt='selection',
        tags=[paper_type, '真题选编'], questions=meta_questions
    )
    out_path.write_text(paper_markdown(meta, sections), encoding='utf-8')
    return True


def build_mock_papers(subject, rows, out_dir):
    """Recombine public real questions into mock training papers.

    Objective rows are used directly. Grouped rows (a reading passage with 3-5
    numbered sub-questions) are split and kept together as one material
    section, so the mock is answerable rather than a wall of unlabelled text.
    """
    pool = []
    seen = set()
    for row in sorted(rows, key=lambda r: (r['_year'], r.get('id', ''))):
        qtext = clean_md_text(row.get('question', ''))
        answers = json_answer(row.get('answer'))
        if not qtext or not answers:
            continue
        intro, parts = split_numbered(qtext)
        grouped_ok = bool(parts) and len(answers) == len(parts)
        single_ok = (
            len(answers) == 1
            and bool(re.fullmatch(r'[A-H]{1,4}', str(answers[0]).strip(), flags=re.I))
            and has_options(qtext)
        )
        if not grouped_ok and not single_ok:
            continue
        h = hashlib.sha1(qtext.encode('utf-8')).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        pool.append(row)

    if len(pool) < 8:
        return 0

    made = 0
    for mi in range(3):
        indices = list(range(len(pool)))
        random.Random(mi * 131 + len(pool)).shuffle(indices)
        selected = [pool[i] for i in indices[:10]]
        if len(selected) < 8:
            continue

        sections = []
        meta_questions = []
        qnum = 0

        def add_question(content, answer_list, score, analysis, material_title):
            nonlocal qnum
            qnum += 1
            raw = strip_question_prefix(content)
            qtype, ans, grading = classify(answer_list, raw, True)
            content = prepare_text(raw, subject)
            meta_questions.append({
                'id': qid(f'mock-{subject}-{mi + 1}', qnum),
                'number': qnum, 'type': qtype, 'score': score,
                'answer': prepare_text(ans, subject),
                'grading': 'auto' if grading else 'self',
                'analysis': prepare_text(analysis, subject), 'section': material_title,
            })
            return {'number': qnum, 'content': content}

        for row in selected:
            qtext = clean_md_text(row.get('question', ''))
            intro, parts = split_numbered(qtext)
            answers = json_answer(row.get('answer'))
            score = float(row.get('score') or 4)
            if score <= 0:
                score = 4.0
            analysis = clean_md_text(row.get('analysis', '') or '')
            material_title = f'材料 {len(sections) + 1}'
            section = {'title': material_title, 'questions': []}
            if parts and len(answers) == len(parts):
                if intro:
                    section['intro'] = prepare_text(intro, subject)
                for pi, (_n, part) in enumerate(parts):
                    section['questions'].append(
                        add_question(part, [answers[pi]], score, analysis, material_title)
                    )
            else:
                section['questions'].append(
                    add_question(qtext, answers, score, analysis, material_title)
                )
            sections.append(section)

        target = TARGET_TOTAL.get(subject, 100)
        total_score = cap_scores(meta_questions, target)
        pid = f'mock-cn-{slug(subject)}-{mi + 1:02d}'
        title = f'2026 届{subject}模拟卷（{CN_NUMS[mi]}）'
        note = ('真题重组模拟卷：从 2016–2024 年公开全国卷中重新组卷，'
                '用于限时训练，不代表命题预测；分值为原题分值。')
        meta = paper_meta(
            pid, title, subject, '全国', 2026, KIND_MOCK,
            duration=60, total_score=total_score,
            source=DATASET_SOURCE, note=note, fmt='objective',
            tags=['真题重组', '限时训练'], questions=meta_questions
        )
        (out_dir / f'{pid}.md').write_text(paper_markdown(meta, sections), encoding='utf-8')
        made += 1
    return made


# ---------------------------------------------------------------------------
# Math PDFs -> full Jiangsu / Shanghai papers, kept as original typeset
# question crops. The PDF text layer destroys maths layout and figures, so the
# questions are rendered from the source pages instead of being flattened into
# plain text.
# ---------------------------------------------------------------------------

Q_LINE_RE = re.compile(r'^(\d{1,2})[.．、](?!\d)\s*')
SECTION_LINE_RE = re.compile(r'^([一二三四五六七八九十]+)、')


def pdf_page_lines(page) -> list[dict]:
    lines = []
    for block in page.get_text('dict')['blocks']:
        if block.get('type') != 0:
            continue
        for line in block['lines']:
            text = ''.join(span['text'] for span in line['spans']).strip()
            if text:
                lines.append({'text': text, 'bbox': list(line['bbox'])})
    return lines


def cluster_positions(values, tolerance: float = 40) -> list[list[float]]:
    groups: list[list[float]] = []
    for value in sorted(values):
        if groups and value - groups[-1][-1] <= tolerance:
            groups[-1].append(value)
        else:
            groups.append([value])
    return groups


def collect_math_questions(doc) -> tuple[list[dict], list[dict]]:
    """Return ordered page records and question/header items in reading order."""
    pages = []
    ordered = []
    expected = 1
    for pno, page in enumerate(doc):
        lines = pdf_page_lines(page)
        starts = [line for line in lines if Q_LINE_RE.match(line['text'])]
        heads = [line for line in lines if SECTION_LINE_RE.match(line['text'])]
        if not starts:
            pages.append({'page': page, 'lines': lines, 'cols': [], 'items': []})
            continue
        groups = cluster_positions([line['bbox'][0] for line in starts + heads])
        cols = [min(group) for group in groups if group]
        items = []
        for kind, pool in (('h', heads), ('q', starts)):
            for line in pool:
                x = line['bbox'][0]
                rank = max((i for i, col in enumerate(cols) if col <= x + 10), default=0)
                items.append({'kind': kind, 'line': line, 'rank': rank})
        items.sort(key=lambda item: (item['rank'], item['line']['bbox'][1]))
        accepted = []
        for item in items:
            if item['kind'] == 'q':
                number = int(Q_LINE_RE.match(item['line']['text']).group(1))
                if number != expected:
                    continue
                expected += 1
                item['number'] = number
            accepted.append(item)
        # Drop sprite/OCR fragments that formed their own fake column.
        used = sorted({item['rank'] for item in accepted})
        remap = {old: new for new, old in enumerate(used)}
        for item in accepted:
            item['rank'] = remap[item['rank']]
        pages.append({
            'page': page,
            'lines': lines,
            'cols': [cols[i] for i in used],
            'items': accepted,
            'number': pno,
        })
        ordered.extend(accepted)
    return pages, ordered


def math_qtype(region: str, qnum: int, section_title: str) -> str:
    if region == '上海':
        if qnum <= 12:
            return 'fill'
        if qnum <= 16:
            return 'single'
        return 'solution'
    if '多选' in section_title:
        return 'multiple'
    if '填空' in section_title:
        return 'fill'
    if '选择' in section_title:
        return 'single'
    if '解答' in section_title:
        return 'solution'
    if qnum <= 8:
        return 'single'
    if qnum <= 12:
        return 'multiple'
    if qnum <= 16:
        return 'fill'
    return 'solution'


def math_section_title(region: str, number: int, title: str) -> str:
    """Repair source headers that were garbled during PDF extraction."""
    if region == '上海':
        if number <= 12:
            return '一、填空题'
        if number <= 16:
            return '二、选择题'
        return '三、解答题'
    if not any(key in title for key in ('单选', '多选', '填空', '解答')):
        if number <= 8:
            return '一、单选题'
        if number <= 12:
            return '二、多选题'
        if number <= 16:
            return '三、填空题'
        return '四、解答题'
    return title


def math_score(region: str, qtype: str, index: int, count: int) -> float:
    if region == '上海':
        # 12 fill (5) + 4 single (5) + 5 solution (14) = 150
        return 14 if qtype == 'solution' else 5
    if qtype == 'multiple':
        # 2024+ new Gaokao I has three multiple-choice questions worth 6.
        return 6 if count <= 3 else 5
    if qtype == 'solution':
        if count == 5:
            return [13, 15, 15, 17, 17][min(index, 4)]
        return 10 if index == 0 else 12
    return 5


def build_math_pdf_paper(path: Path):
    import pymupdf

    name = path.stem
    match = re.match(r'(\d{4})(上海|.*?江苏)', name)
    if not match:
        return None
    year = int(match.group(1))
    region = '上海' if '上海' in name else '江苏'
    if region == '上海' and year == 2017:
        # The 2017 Shanghai PDF lost every option label in extraction.
        print('skip incomplete pdf', name)
        return None

    doc = pymupdf.open(path)
    pages, items = collect_math_questions(doc)
    question_items = [item for item in items if item['kind'] == 'q']
    if len(question_items) < 15:
        print('math pdf parse too short', name, len(question_items))
        return None

    # Assign sections in reading order; headers carry over across columns/pages.
    section = '试题'
    for item in items:
        if item['kind'] == 'h':
            section = item['line']['text'].strip('、')
        else:
            item['section'] = math_section_title(region, item['number'], section)

    section_counts = defaultdict(int)
    for item in question_items:
        section_counts[item['section']] += 1

    pid = f'real-{slug(region)}-math-{year}'
    asset_key = f'{year}-{"jiangsu" if region == "江苏" else "shanghai"}'
    image_dir = MATH_IMAGE_DIR / asset_key
    image_dir.mkdir(parents=True, exist_ok=True)

    index_in_section = defaultdict(int)
    meta_questions = []
    total_score = 0.0
    for item in question_items:
        number = item['number']
        qtype = math_qtype(region, number, item['section'])
        index = index_in_section[item['section']]
        index_in_section[item['section']] += 1
        score = math_score(region, qtype, index, section_counts[item['section']])
        total_score += score
        meta_questions.append({
            'id': qid(f'{region}-math-{year}', number),
            'number': number,
            'type': qtype,
            'score': score,
            'answer': '',
            'grading': 'self',
            'analysis': '',
            'section': item['section'],
        })

    # Keep every paper at its official full mark, even when one source page is
    # slightly truncated.
    if meta_questions and abs(total_score - 150) > 0.01:
        meta_questions[-1]['score'] = round(meta_questions[-1]['score'] + 150 - total_score, 1)
        total_score = 150.0

    # Crop each question (including its figures) from the typeset source page.
    for record in pages:
        page = record['page']
        cols = record['cols']
        local_items = record['items']
        for item in local_items:
            if item['kind'] != 'q':
                continue
            number = item['number']
            rank = item['rank']
            x0 = cols[rank] - 10
            # Columns sit only ~10pt apart in the typeset PDF; keep a small
            # gutter so the rightmost parenthesis of the column is not clipped.
            x1 = (cols[rank + 1] - 3) if rank + 1 < len(cols) else page.rect.width - 22
            below = [
                other for other in local_items
                if other['rank'] == rank and other['line']['bbox'][1] > item['line']['bbox'][1]
            ]
            if below:
                # A fraction or radical in the last option can sit within a
                # couple of points of the next question's first line.
                y1 = min(other['line']['bbox'][1] for other in below) - 1.5
            else:
                content = [
                    line for line in record['lines']
                    if x0 - 4 <= line['bbox'][0] <= x1
                    and line['bbox'][1] >= item['line']['bbox'][1]
                    and not re.fullmatch(r'\d{1,4}', line['text'])
                    and line['bbox'][1] < page.rect.height * 0.93
                ]
                y1 = (max(line['bbox'][3] for line in content) + 8) if content else page.rect.height - 45
            rect = pymupdf.Rect(x0, max(0, item['line']['bbox'][1] - 5), x1, min(y1, page.rect.height - 20))
            pix = page.get_pixmap(clip=rect, matrix=pymupdf.Matrix(2.2, 2.2))
            image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            image.save(image_dir / f'q{number:02d}.webp', 'WEBP', quality=84, method=6)

    sections = []
    for item in question_items:
        if not sections or sections[-1]['title'] != item['section']:
            sections.append({'title': item['section'], 'questions': []})
        sections[-1]['questions'].append({
            'number': item['number'],
            'content': f'![第 {item["number"]} 题](./paper-assets/math/{asset_key}/q{item["number"]:02d}.webp)',
        })

    if region == '江苏':
        title = f'{year} 年江苏省高考数学试卷'
        note = ('江苏省自 2021 年起使用新高考 I 卷。题干以原卷版式内联呈现，'
                '公式与图形保持排版原样；原卷未附参考答案，交卷后请对照题目自评。')
        tags = ['新高考I卷', '原卷版式', '自评卷']
    else:
        title = f'{year} 年上海市高考数学试卷'
        note = ('题干以原卷版式内联呈现，公式与图形保持排版原样；'
                '原卷未附参考答案，交卷后请对照题目自评。')
        tags = ['上海卷', '原卷版式', '自评卷']

    meta = paper_meta(
        pid, title, '数学', region, year, KIND_REAL,
        duration=120, total_score=round(total_score, 1),
        source=MATH_SOURCE, note=note, fmt='full', tags=tags,
        questions=meta_questions,
    )
    doc.close()
    return pid, paper_markdown(meta, sections)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.md'):
        old.unlink()
    shutil.rmtree(MATH_IMAGE_DIR, ignore_errors=True)
    MATH_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    groups = load_dataset_rows()
    print('dataset groups', len(groups))

    real_count = 0
    mock_count = 0
    subject_rows = defaultdict(list)

    for (subject, year), rows in sorted(groups.items(), key=lambda kv: (SUBJECT_ORDER.get(kv[0][0], 99), kv[0][1])):
        if not (2016 <= year <= 2024):
            continue
        subject_rows[subject].extend(rows)
        # Choose the most complete paper type for this subject/year. For math
        # prefer the new Gaokao paper where available.
        by_type = defaultdict(list)
        for r in rows:
            by_type[r['_paper_type']].append(r)
        if not by_type:
            continue
        if subject == '数学' and '新高考卷' in by_type:
            paper_type = '新高考卷'
        else:
            paper_type = max(by_type, key=lambda t: len(by_type[t]))
        chosen = by_type[paper_type]
        pid = f'real-cn-{slug(subject)}-{year}-{slug(paper_type)}'
        if build_selection_paper(subject, year, paper_type, chosen, OUT / f'{pid}.md'):
            real_count += 1

    for subject in SUBJECTS:
        rows = subject_rows[subject]
        if rows:
            mock_count += build_mock_papers(subject, rows, OUT)

    math_count = 0
    if PDF_DIR.exists():
        for path in sorted(PDF_DIR.glob('*.pdf')):
            try:
                result = build_math_pdf_paper(path)
                if result:
                    pid, md = result
                    (OUT / f'{pid}.md').write_text(md, encoding='utf-8')
                    math_count += 1
            except Exception as exc:
                print('pdf error', path.name, exc)

    print(f'generated: {real_count} real selections, {mock_count} mocks, {math_count} full math papers')
    print('total md', len(list(OUT.glob('*.md'))))


if __name__ == '__main__':
    main()
