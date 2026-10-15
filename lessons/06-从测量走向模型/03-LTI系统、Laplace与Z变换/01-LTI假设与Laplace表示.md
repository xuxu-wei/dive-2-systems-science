# 6.3.1 线性时不变系统与 Laplace 变换

学完本节，你应能检验输入与响应的叠加和平移，分开初态与后续输入的贡献，并从单室方程推导带初值项的 Laplace 表示。

**先修知识**：第2篇的乘积求导与定积分，6.2的线性卷积，以及第3篇的复数表示。

## 单室方程与响应分解 {#initial-and-input-response}

培养室起初已有3 U物质，随后以恒定流率输入。把输入流率加倍，任一时刻的总量也会加倍吗？新增输入的贡献会加倍，最初那3 U留下的部分却保持原样。先把两部分分开，才能准确描述输入与输出的关系。

沿用总量方程

$$\dot x(t)=-kx(t)+u(t),\qquad x(0)=x_0.$$

$x$是所追踪物质总量，单位U；$u$是输入流率，单位U/T。$k$是恒定的**一阶消除速率常数**，单位$\mathrm{T^{-1}}$：它决定清除快慢，乘以当前总量得到消除流率$kx$。物质实验取$k\ge0$以及非负初态和输入。

把方程写成$\dot x+kx=u$，乘以积分因子$e^{kt}$：

$$\frac{d}{dt}(e^{kt}x(t))=e^{kt}u(t).$$

从0积分到$t$，再乘回$e^{-kt}$，就有

$$\boxed{x(t)=x_0e^{-kt}+\int_0^te^{-k(t-\tau)}u(\tau)\,d\tau.}$$

第一项是**零输入响应**：后续输入为零，初始总量继续留下多少。第二项是**零状态响应**：初态为零，后续输入累积出多少。这里输入分段连续，0时刻没有瞬时投放，所以$x(0^-)=x(0^+)=x_0$。

恒定流率为$u_0$、$k>0$时，积分给出

$$x(t)=\underbrace{x_0e^{-kt}}_{\text{初态贡献}}
+\underbrace{\frac{u_0}{k}(1-e^{-kt})}_{\text{输入贡献}}.$$

取$k=0.4\,\mathrm{T^{-1}}$、$x_0=3\,\mathrm U$、$t=2\,\mathrm T$，两部分约为

| 输入流率 / (U/T) | 初态贡献 / U | 输入贡献 / U | 总量 / U |
|---:|---:|---:|---:|
| 0 | 1.3480 | 0 | 1.3480 |
| 1 | 1.3480 | 1.3767 | 2.7247 |
| 2 | 1.3480 | 2.7534 | 4.1013 |

第三行的总量小于第二行总量的两倍，少的正是一份初态贡献。

<!-- practice: p06-response-components -->

## 线性与时不变的定义 {#lti-zero-state-map}

令$\mathcal T$表示从输入$u$到零状态响应的映射。**线性（linearity）**要求叠加关系

$$\mathcal T(c_1u_1+c_2u_2)=c_1\mathcal T(u_1)+c_2\mathcal T(u_2)$$

对允许的输入及实数系数成立。也就是说，分别施加两个输入再把响应按比例相加，与先合成输入再运行系统得到同一结果。数学上可在有正负值的信号空间检验它；物质实验使用其中的非负输入。

积分的可加性使本例满足这个等式。固定非零初态时，完整响应还多一项$x_0e^{-kt}$：零输入也可能得到非零输出，因此$u\mapsto x$一般是**仿射映射**，即线性映射加上固定项。若把输入和初态一起乘$c$，两部分才都乘$c$。

<!-- practice: p06-linear-map-initial -->

**时不变（time invariance）**要求：把输入推迟一段时间，零状态响应也只推迟同样时间，形状不变。具体地，输入在0以前为零，将它推迟$d\ge0$得到

$$u_d(t)=\begin{cases}0,&t<d,\\u(t-d),&t\ge d.\end{cases}$$

对$t\ge d$，将积分中的$\tau$换成$v+d$：

$$\begin{aligned}
\mathcal T(u_d)(t)
&=\int_d^t e^{-k(t-\tau)}u(\tau-d)\,d\tau\\
&=\int_0^{t-d}e^{-k((t-d)-v)}u(v)\,dv
=\mathcal T(u)(t-d).
\end{aligned}$$

它只依赖输入作用以后经过多久。线性和时不变同时成立时，称为**线性时不变系统（linear time-invariant system，LTI）**。本例的零状态响应就是输入与因果核$g(t)=e^{-kt}$（$t\ge0$）的卷积。

若改成$\dot x=-k(t)x+u$，给定的系数随绝对时间改变，叠加仍成立，时不变性一般失效；若改成饱和消除$\dot x=-V_{\max}x/(K+x)+u$，$V_{\max},K$恒定，规则不随时间变，但非线性分式破坏叠加。

<!-- practice: p06-lti-failure -->

## Laplace 变换与收敛域 {#laplace-definition-roc}

卷积把任意时刻输入的贡献都加起来；变换则让微分和卷积转成更便于求解的代数关系。定义从0开始的**单侧 Laplace 变换**

$$X(s)=\int_0^\infty x(t)e^{-st}\,dt,
\qquad s=\sigma+i\omega.$$

$s$的单位是$\mathrm{T^{-1}}$。实部$\sigma$控制额外的指数衰减，虚部$\omega$对应连续时间旋转，单位为rad/T；固定一个$s$，变换就是按这个复指数权重对整条曲线积分。使积分收敛的$s$组成**收敛域（region of convergence，ROC）**。

例如，对因果核$g(t)=e^{-kt}$，

$$\begin{aligned}
G(s)&=\int_0^\infty e^{-(s+k)t}\,dt\\
&=\left[-\frac{e^{-(s+k)t}}{s+k}\right]_0^\infty
=\frac1{s+k},\qquad \operatorname{Re}(s)>-k.
\end{aligned}$$

实部条件使无穷远的指数项趋零，不能在代数式写出后丢掉。不同时间信号的收敛要求也可能不同：非零恒定信号的变换为常数除以$s$，要求$\operatorname{Re}(s)>0$；因此恒定输入产生的完整响应，要按其自身的收敛条件使用变换。

## 导数变换与初值项 {#laplace-derivative-initial}

先对乘积求导：

$$\frac{d}{dt}(x(t)e^{-st})=\dot x(t)e^{-st}-s x(t)e^{-st}.$$

把最后一项移到右侧并从0积分到无穷，就能将导数的变换写成边界项与原变换：

$$\begin{aligned}
\mathcal L\{\dot x\}
&=\int_0^\infty \dot x(t)e^{-st}\,dt\\
&=\left[x(t)e^{-st}\right]_0^\infty
+s\int_0^\infty x(t)e^{-st}\,dt\\
&=sX(s)-x_0.
\end{aligned}$$

这里选取的$s$还要让$x(t)e^{-st}$在无穷远消失。0时刻的下边界留下$-x_0$，这就是初值项的来源。

记输入变换为$U(s)$，对$\dot x=-kx+u$逐项变换：

$$sX(s)-x_0=-kX(s)+U(s),$$

所以

$$\boxed{X(s)=\frac{x_0}{s+k}+\frac1{s+k}U(s).}$$

它与时间域的两部分一一对应：第一项保留初态，第二项传递输入。

<!-- practice: p06-laplace-initial -->

## 传递函数、极点与有界响应 {#transfer-function-pole-stability}

**传递函数（transfer function）**描述零状态下的输入输出关系，定义为使$X(s)=H(s)U(s)$成立的$H(s)$。本例为

$$H(s)=\frac1{s+k}.$$

$X(s)$单位为U·T，$U(s)$单位为U，因此$H$单位为T；它把输入流率的变换连接到总量的变换。当$k>0$时，取$s=0$得到恒定输入的稳态增益$1/k$，与$x^*=u_0/k$一致。

对约去公共因子的有理函数，分母的根叫**极点（pole）**，分子的根叫**零点（zero）**。本例极点为$s=-k$，没有有限零点。$k>0$时极点位于左半平面，对应随时间衰减的指数。

这个衰减怎样保证输入不会累积成无界输出？若输入始终满足$|u(t)|\le M$，零状态响应满足

$$|x(t)|\le M\int_0^t e^{-k(t-\tau)}\,d\tau\le\frac Mk.$$

因此它具有**有界输入有界输出稳定性（BIBO stability）**：任一有界输入都产生有界零状态输出。这里用到核的绝对积分$\int_0^\infty|g(t)|\,dt=1/k$。极点位置、指数衰减和这个积分在同一个模型中相互对应。

<!-- practice: p06-roc-causal -->

$k=0$时，方程变成$\dot x=u$，响应为$x_0+\int_0^tu(\tau)d\tau$。非零恒定输入会一直累积，这个**积分器**没有上述BIBO稳定性；恒定输入公式的极限则是$x_0+u_0t$。

## 初态响应与输入响应的对照 {#response-components-experiment}

下图固定$k=0.4\,\mathrm{T^{-1}}$、$x_0=3\,\mathrm U$。左图把流率1 U/T产生的两部分相加；右图比较“仅将输入加倍”与“把原来的整个响应加倍”。

<!-- experiment: 249d874c figure -->

左图的初态贡献下降，输入贡献趋近2.5 U。右图两条曲线的差是一份初态响应$3e^{-0.4t}$ U，随时间衰减。输入输出的叠加关系落在零状态部分；固定初态则为完整响应增加一个与输入无关的部分。

探索时先把$u$设为0，观察初态留下的轨迹；再把初始总量设为0，观察输入累积。接下来保持同一连续模型，改变采样间隔，便能把这些连续曲线与离散递推连接起来。

<!-- explore -->

## 参考资料 {#references}

[MIT 6.003 第6讲](https://ocw.mit.edu/courses/6-003-signals-and-systems-fall-2011/resources/mit6_003f11_lec06/)连接连续方程、Laplace变换、收敛域与极点。讲义同时讨论双侧变换；本节用从0开始的单侧形式保留初值。
