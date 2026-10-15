# 16.2.1 鲁棒稳定性、共同二次函数与顶点条件

反馈已经选定，但恢复系数只能确定在一个区间。每个可能系数都对应一条闭环方程，如何检查整组模型都能恢复？我们先用同一个平方距离衡量两端模型，再利用矩阵之间的凸组合关系覆盖中间情形。

学完本节，应能构造仿射模型集合，计算二次函数的导数矩阵，并推导共同顶点条件。先修为16.1的下降论证，第3篇的二次型与特征值，以及第8篇的凸性。

## 归一化偏差与模型集合 {#normalized-deviations-and-the-model-set}

本章状态$x=(x_1,x_2)^{\mathsf T}$包含两个偏差，各自除以相应参考尺度后成为无量纲数值。连续闭环为$\dot x=Ax$，矩阵元素以$1/T$计。

允许模型的两个端点是

$$A_0=\frac1T\begin{pmatrix}-0.4&0.1\\0&-0.5\end{pmatrix},
\qquad A_1=\frac1T\begin{pmatrix}-0.8&0.1\\0&-0.5\end{pmatrix}.$$

第二方向按同一个恢复率变化，第一方向的自身系数位于$[-0.8,-0.4]/T$。用权重$0\le\alpha\le1$表示

$$\boxed{A(\alpha)=(1-\alpha)A_0+\alpha A_1.}$$

矩阵每个元素都是$\alpha$的一次函数，这称为**仿射参数依赖**。两个权重非负且和为1，得到的所有矩阵构成端点的凸包。例如$\alpha=0.5$时，第一对角元素为$-0.6/T$，其余元素不变。

<!-- practice: p16-affine-model -->

**鲁棒稳定性（robust stability）**在这里要求：给定集合中的每一个闭环模型都稳定。先把“允许哪些模型”写成上述集合，稳定性分析才有明确覆盖对象。

## 共同二次Lyapunov函数 {#a-common-quadratic-lyapunov-function}

选择同一个实对称正定矩阵$P$，定义

$$V(x)=x^{\mathsf T}Px.$$

本例归一化状态与$P$均无量纲，$V$也无量纲。$P\succ0$表示对每个非零$x$都有$x^{\mathsf T}Px>0$，它为不同方向分配同一套平方距离权重。

沿$\dot x=Ax$用乘积法则求导：

$$\begin{aligned}
\dot V&=\dot x^{\mathsf T}Px+x^{\mathsf T}P\dot x\\
&=x^{\mathsf T}(A^{\mathsf T}P+PA)x.
\end{aligned}$$

记对称导数矩阵为$S=A^{\mathsf T}P+PA$，单位为$1/T$。$S\prec0$即负定，意味着所有非零方向都使$V$严格下降；对称矩阵的最大特征值小于零，正好能检查这个条件。

若同一个$P$对集合中的全部模型都满足下降，它就给出一个**共同二次Lyapunov函数（common quadratic Lyapunov function）**。直观上，不论恢复系数在允许范围内取哪个值，都用同一把距离尺衡量向零运动。

## 两个端点的手算 {#hand-calculation-at-the-two-vertices}

取$P=I$。两端的导数矩阵为

$$S_0=\frac1T\begin{pmatrix}-0.8&0.1\\0.1&-1\end{pmatrix},
\qquad S_1=\frac1T\begin{pmatrix}-1.6&0.1\\0.1&-1\end{pmatrix}.$$

对一般对称二维矩阵$\left(\begin{smallmatrix}r&s\\s&t\end{smallmatrix}\right)$，特征方程$(r-\lambda)(t-\lambda)-s^2=0$给出

$$\lambda_{\max}=\frac{r+t}{2}
+\sqrt{\left(\frac{r-t}{2}\right)^2+s^2}.$$

因此$S_0$的最大特征值为$[-0.9+\sqrt{0.02}]/T\approx-0.758579/T$；$S_1$则为$[-1.3+\sqrt{0.1}]/T\approx-0.983772/T$。两者均严格为负，$P=I$的最小特征值为1。

计算题依次返回$P$的最小特征值、各端点导数矩阵最大特征值组成的列表，以及严格条件全部成立的布尔值。这里得到$[1,[-0.758579,-0.983772],\mathrm{True}]$的近似数值；等于零的特征值不满足题给严格不等式。

<!-- practice: p16-common-certificate -->

## 仿射结构为何使顶点检查充分 {#why-affine-structure-makes-vertex-checking-sufficient}

固定$P$后，将模型的凸组合代入导数矩阵：

$$\begin{aligned}
S(\alpha)&=[(1-\alpha)A_0+\alpha A_1]^{\mathsf T}P
+P[(1-\alpha)A_0+\alpha A_1]\\
&=(1-\alpha)S_0+\alpha S_1.
\end{aligned}$$

所以对每个非零$x$，

$$x^{\mathsf T}S(\alpha)x
=(1-\alpha)x^{\mathsf T}S_0x+\alpha x^{\mathsf T}S_1x<0.$$

右端是两个严格负数的凸组合。两个端点都通过同一$P$，就覆盖了这条仿射区间。

<!-- practice: p16-common-p -->

共同性正是在代数展开时用到的：同一个$P$才能提出到两个权重之外。若每个端点分别使用自己的$P_i$，得到的是各模型各自的一套距离，不能组成上面的同一个$S(\alpha)$。

同样，真实允许矩阵需要属于这些端点的凸包。参数数值介于两端之间，但矩阵按另一条弯曲关系变化时，要先检查它是否仍在这个矩阵集合内。

<!-- practice: p16-vertex-scope -->

## 共同下降与统一恢复界 {#common-descent-and-a-uniform-decay-bound}

令$\delta=\min_i[-\lambda_{\max}(S_i)]>0$。每个端点都满足$x^{\mathsf T}S_ix\le-\delta\|x\|^2$，凸组合也保留这一界。又因为$V\le\lambda_{\max}(P)\|x\|^2$，有

$$\dot V\le-\frac{\delta}{\lambda_{\max}(P)}V.$$

这就把严格下降转成了对整组模型共同有效的指数界。本例$P=I$，可取$\delta\approx0.758579/T$，因而

$$\|x(t)\|\le e^{-0.379289t/T}\|x_0\|.$$

对给定端点，$P\succ0$和$A_i^{\mathsf T}P+PA_i\prec0$关于未知$P$的元素是线性的矩阵正负定约束，称为**线性矩阵不等式（linear matrix inequality，LMI）**。本例已给$P$并直接检查；寻找共同$P$则可以把这些条件作为求解目标的可行约束。

## 区间曲线与共同矩阵探索 {#interval-curve-and-common-matrix-exploration}

固定$P=I$，在0到1取51个$\alpha$，逐点计算最大导数特征值。

<!-- experiment: 5d74573c figure -->

曲线始终低于零，端点分别约为$-0.758579/T$和$-0.983772/T$。图显示负值离零多远；覆盖连续区间的依据则是共同矩阵和凸组合推导。

探索页还能改变$P=\operatorname{diag}(p,1)$中的$p$，先保持同一$p$检查两个端点，再移动$\alpha$看中间值。切换集合外反例时，粉点使用第一对角元素$+0.2/T$的另一矩阵；它被放在横坐标1.15，仅作图上位置标记。

<!-- explore -->

下一节分别检查候选$P$未通过和矩阵本身失稳，让这两种判断各自对应到具体计算。

## 参考资料 {#references}

[Boyd等：Linear Matrix Inequalities in System and Control Theory](https://web.stanford.edu/~boyd/lmibook/)，进一步讨论共同二次函数和矩阵不等式；本例用仿射区间将顶点条件逐项展开。
