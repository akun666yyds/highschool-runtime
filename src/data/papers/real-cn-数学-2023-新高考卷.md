---
id: real-cn-数学-2023-新高考卷
title: 2023 年高考数学真题选编 · 新高考卷
subject: 数学
region: 全国
year: 2023
kind: real
format: selection
duration: 30
totalScore: 35.0
sourceName: GAOKAO-Bench 公开真题集
sourceUrl: https://github.com/rainewhk/gaokao
sourceNote: 由公开高考真题整理，依据 Apache-2.0 许可使用；部分题型从略。
note: 依据公开全国卷真题整理，按题型分节呈现；分值为原题分值，题量以公开真题为准，部分题型从略。
tags:
- 新高考卷
- 真题选编
questions:
- id: 数学-2023-q01
  number: 1
  type: single
  score: 5.0
  answer: B
  grading: auto
  analysis: '【详解】因为 $A \subseteq B$, 则有:

    若 $a-2=0$, 解得 $a=2$, 此时 $A=\{0,-2\}, B=\{1,0,2\}$, 不符合题意;若 $2 a-2=0$, 解得 $a=1$, 此时 $A=\{0,-1\}, B=\{1,-1,0\}$, 符合题意;综上所述: $a=1$.

    故选: B.'
  section: 选择题
- id: 数学-2023-q02
  number: 2
  type: single
  score: 5.0
  answer: D
  grading: auto
  analysis: '【详解】根据分层抽样的定义知初中部共抽取 $60 \times \frac{400}{600}=40$ 人, 高中部共抽取 $60 \times \frac{200}{600}=20$,根据组合公式和分步计数原理则不同的抽样结果共有 $\mathrm{C}_{400}^{40} \cdot \mathrm{C}_{200}^{20}$ 种.故选: D.'
  section: 选择题
- id: 数学-2023-q03
  number: 3
  type: single
  score: 5.0
  answer: B
  grading: auto
  analysis: '【详解】因为 $f(x)$ 为偶函数, 则 $f(1)=f(-1) \measuredangle:(1+a) \ln \frac{1}{3}=(-1+a) \ln 3$, 解得 $a=0$,当 $a=0$ 时, $f(x)=x \ln \frac{2 x-1}{2 x+1},(2 x-1)(2 x+1)>0$, 解得 $x>\frac{1}{2}$ 或 $x<-\frac{1}{2}$,则其定义域为 $\left\{x|x\rangle \frac{1}{2}\right.$ 或 $\left.x<-\frac{1}{2}\right\}$, 关于原点对称.

    $$f(-x)=(-x) \ln \frac{2(-x)-1}{2(-x)+1}=(-x) \ln \frac{2 x+1}{2 x-1}=(-x) \ln \left(\frac{2 x-1}{2 x+1}\right)^{-1}=x \ln \frac{2 x-1}{2 x+1}=f(x) \text {, }$$故此时$f(x)$ 为偶函数.

    故选: B.'
  section: 选择题
- id: 数学-2023-q04
  number: 4
  type: single
  score: 5.0
  answer: C
  grading: auto
  analysis: '【详解】将直线 $y=x+m$ 与椭圆联立 $\left\{\begin{array}{l}y=x+m \\ \frac{x^2}{3}+y^2=1\end{array}\right.$, 消去 $y$ 可得 $4 x^2+6 m x+3 m^2-3=0$,因为直线与椭圆相交于 $A, B$ 点, 则 $\Delta=36 m^2-4 \times 4\left(3 m^2-3\right)>0$, 解得 $-2<m<2$,设 $F_1$ 到 $A B$ 距离 $d_1, F_2$ 到 $A B$ 距离 $d_2$, 易知 $F_1(-\sqrt{2}, 0), F_2(\sqrt{2}, 0)$,

    则 $d_1=\frac{|-\sqrt{2}+m|}{\sqrt{2}}, d_2=\frac{|\sqrt{2}+m|}{\sqrt{2}}$, $\frac{S_{\triangle F_1 A B}}{S_{\triangle F_2 A B}}=\frac{\frac{|-\sqrt{2}+m|}{\sqrt{2}}}{\frac{|\sqrt{2}+m|}{\sqrt{2}}}=\frac{|-\sqrt{2}+m|}{|\sqrt{2}+m|}=2$, 解得 $m=-\frac{\sqrt{2}}{3}$ 或 $-3 \sqrt{2}$ (舍去),故选: C.'
  section: 选择题
- id: 数学-2023-q05
  number: 5
  type: single
  score: 5.0
  answer: C
  grading: auto
  analysis: '【详解】依题可知, $f^{\prime}(x)=a \mathrm{e}^x-\frac{1}{x} \geq 0$ 在 $(1,2)$ 上恒成立, 显然 $a>0$, 所以 $x \mathrm{e}^x \geq \frac{1}{a}$,设 $g(x)=x \mathrm{e}^x, x \in(1,2)$, 所以 $g^{\prime}(x)=(x+1) \mathrm{e}^x>0$, 所以 $g(x)$ 在 $(1,2)$ 上单调递增, $g(x)>g(1)=\mathrm{e}$, 故 $\mathrm{e} \geq \frac{1}{a}$, 即 $a \geq \frac{1}{\mathrm{e}}=\mathrm{e}^{-1}$, 即 $a$ 的最小值为 $\mathrm{e}^{-1}$.故选: C.'
  section: 选择题
- id: 数学-2023-q06
  number: 6
  type: single
  score: 5.0
  answer: D
  grading: auto
  analysis: '【详解】因为 $\cos \alpha=1-2 \sin ^2 \frac{\alpha}{2}=\frac{1+\sqrt{5}}{4}$, 而 $\alpha$ 为锐角,解得: $\sin \frac{\alpha}{2}=\sqrt{\frac{3-\sqrt{5}}{8}}=\sqrt{\frac{(\sqrt{5}-1)^2}{16}}=\frac{\sqrt{5}-1}{4}$.故选: D.'
  section: 选择题
- id: 数学-2023-q07
  number: 7
  type: single
  score: 5.0
  answer: C
  grading: auto
  analysis: '【详解】方法一：设等比数列 $\left\{a_n\right\}$ 的公比为 $q$, 首项为 $a_1$,

    若 $q=1$, 则 $S_6=6 a_1=3 \times 2 a_1=3 S_2$, 与题意不符, 所以 $q \neq 1$;

    由 $S_4=-5, S_6=21 S_2$ 可得, $\frac{a_1\left(1-q^4\right)}{1-q}=-5, \frac{a_1\left(1-q^6\right)}{1-q}=21 \times \frac{a_1\left(1-q^2\right)}{1-q}$ (1),

    由(1)可得, $1+q^2+q^4=21$, 解得: $q^2=4$,

    所以 $S_8=\frac{a_1\left(1-q^8\right)}{1-q}=\frac{a_1\left(1-q^4\right)}{1-q} \times\left(1+q^4\right)=-5 \times(1+16)=-85$.

    故选: C.'
  section: 选择题
---

# 2023 年高考数学真题选编 · 新高考卷

> 依据公开全国卷真题整理，按题型分节呈现；分值为原题分值，题量以公开真题为准，部分题型从略。

## 选择题

### 第 1 题

设集合 $A=\{0,-a\}, B=\{1, a-2,2 a-2\}$, 若 $A \subseteq B$, 则 $a=()$.  
A. 2  
B. 1  
C. $\frac{2}{3}$  
D. -1

### 第 2 题

某学校为了解学生参加体育运动的情况, 用比例分配的分层随机抽样方法作抽样调查, 拟从初中部和高中部两层共抽取 60 名学生, 已知该校初中部和高中部分别有 400 名和 200 名学生, 则不同的抽样结果共有 $()$.  
A. $\mathrm{C}_{400}^{45} \cdot \mathrm{C}_{200}^{15}$ 种  
B. $\mathrm{C}_{400}^{20} \cdot \mathrm{C}_{200}^{40}$ 种  
C. $\mathrm{C}_{400}^{30} \cdot \mathrm{C}_{200}^{30}$ 种  
D. $\mathrm{C}_{400}^{40} \cdot \mathrm{C}_{200}^{20}$ 种

### 第 3 题

若 $f(x)=(x+a) \ln \frac{2 x-1}{2 x+1}$ 为偶函数, 则 $a=()$.  
A. -1  
B. 0  
C. $\frac{1}{2}$  
D. 1

### 第 4 题

已知椭圆 $C: \frac{x^2}{3}+y^2=1$ 的左、右焦点分别为 $F_1, F_2$, 直线 $y=x+m$ 与 $C$ 交于 $A, B$ 两点, 若$\triangle F_1 A B$ 面积是$\triangle F_2 A B$ 面积的 2 倍, 则 $m=()$.  
A. $\frac{2}{3}$  
B. $\frac{\sqrt{2}}{3}$  
C. $-\frac{\sqrt{2}}{3}$  
D. $-\frac{2}{3}$

### 第 5 题

已知函数 $f(x)=a \mathrm{e}^x-\ln x$ 在区间 $(1,2)$ 上单调递增，则 $a$ 的最小值为 $()$.  
A. $e^2$  
B. e  
C. $\mathrm{e}^{-1}$  
D. $\mathrm{e}^{-2}$

### 第 6 题

已知 $\alpha$ 为锐角, $\cos \alpha=\frac{1+\sqrt{5}}{4}$, 则 $\sin \frac{\alpha}{2}=()$.  
A. $\frac{3-\sqrt{5}}{8} \rightarrow$  
B. $\frac{-1+\sqrt{5}}{8} \rightarrow$  
C. $\frac{3-\sqrt{5}}{4} \rightarrow$  
D. $\frac{-1+\sqrt{5}}{4}$

### 第 7 题

记 $S_n$ 为等比数列 $\left\{a_n\right\}$ 的前 $n$ 项和, 若 $S_4=-5, S_6=21 S_2$, 则 $S_8=()$.  
A. 120  
B. 85  
C. -85  
D. -120
