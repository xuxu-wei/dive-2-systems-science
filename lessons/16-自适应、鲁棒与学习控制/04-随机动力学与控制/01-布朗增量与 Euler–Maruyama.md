# 16.4.1 布朗运动与Euler–Maruyama离散

前面的恢复模型决定了同一初态之后的轨迹。若系统每一步都受到随机扰动，相同初态会产生不同路径。缩短时间步时，确定性变化和随机变化各应该缩小多少？我们从随机增量的方差建立这条更新规则。

学完本节，你应能解释布朗增量的平方根缩放，手算Euler–Maruyama更新，并构造共享随机驱动的粗细网格。先修为第5篇的随机过程、独立性和方差，以及第2篇的Euler方法。

## 布朗运动与独立增量 {#brownian-motion-and-independent-increments}

**标准布朗运动（standard Brownian motion）**$W_t$是一种连续时间随机过程：$W_0=0$，路径连续；互不重叠时间区间的增量相互独立，且长度为$h$的增量满足

$$\Delta W=W_{t+h}-W_t\sim\mathcal N(0,h).$$

因此$\mathbb E[\Delta W]=0$、$\operatorname{Var}(\Delta W)=h$。时间按T记录时，$W$和$\Delta W$对应$\sqrt{\mathrm T}$单位。这里$h$控制的是方差，典型增量幅度由标准差$\sqrt h$描述。

若$Z\sim\mathcal N(0,1)$，则

$$\boxed{\Delta W=\sqrt h\,Z}$$

具有所需分布，因为$\operatorname{Var}(\sqrt h\,Z)=h$。例如$h=0.04$ T，三个预先给定的标准化数$(-1,0.5,1)$对应增量$(-0.2,0.1,0.2)\sqrt{\mathrm T}$。若改乘$h$，得到的是$h^2$方差；这会改变随机驱动随时间积累的规律。

<!-- practice: p16-brownian-scale -->

## 稳态偏差的OU随机恢复 {#ou-restoration-of-state-deviation}

令$X$为相对参考水平的偏差，单位为U。例如$X=-0.2$ U表示比参考低0.2 U。线性恢复和持续随机扰动可写成

$$\boxed{dX_t=-aX_t\,dt+\sigma\,dW_t.}$$

这是一个Itô随机微分方程（stochastic differential equation，SDE），也称**Ornstein–Uhlenbeck过程，简称OU过程**。$a\ge0$为恢复率，单位$1/\mathrm T$；$\sigma\ge0$为扰动幅度，单位$\mathrm U/\sqrt{\mathrm T}$。当$a>0$，漂移项$-aX$把正、负偏差都拉向零；随机项继续带来两种方向的变化。

对于这里不随状态变化的$\sigma$，方程可以先理解为累计关系

$$X_t=x_0-\int_0^t aX_s\,ds+\sigma W_t.$$

第一项积分累计确定性的恢复，后一项累计布朗扰动。这样写依赖的是一段时间内的随机增量，而不是把布朗路径当作一条具有普通导数的光滑曲线。

两项单位都能核对：$aX\,dt$为U，$\sigma\,dW$也是U。它们的时间尺度不同：恢复量在小区间中近似正比于$h$，随机量的标准差则正比于$\sqrt h$。

## Euler–Maruyama更新与两步手算 {#euler-maruyama-update}

在区间$[t_n,t_n+h]$内，用旧状态$X_n$近似漂移中的$X_s$，随机项使用这个区间的布朗增量，得到**Euler–Maruyama方法**：

$$\boxed{X_{n+1}=(1-ah)X_n+\sigma\Delta W_n.}$$

若输入是标准正态数$Z_n$，先令$\Delta W_n=\sqrt h\,Z_n$。若已经给出布朗增量，就用上式中的$\sigma\Delta W_n$；给定的增量决定了这条数值路径。

手算$x_0=1$ U、$a=1/\mathrm T$、$\sigma=0.5\,\mathrm U/\sqrt{\mathrm T}$、$h=0.1$ T。给定两次增量$0.2,-0.1$，单位均为$\sqrt{\mathrm T}$，有

$$\begin{aligned}
X_1&=1-1\times0.1\times1+0.5\times0.2=1\,\mathrm U,\\
X_2&=1-1\times0.1\times1+0.5(-0.1)=0.85\,\mathrm U.
\end{aligned}$$

返回的状态路径为$(1,1,0.85)$ U，含起点，长度比增量列表多1。每一步的恢复项都读取本步旧状态。

<!-- practice: p16-em-increments -->

## 同一驱动上的增量合并 {#coupled-brownian-increments}

比较粗细网格时，先让它们受到同一条布朗路径的扰动。一粗步含$B$个连续细步，粗增量为

$$\Delta W_j^{\mathrm{coarse}}
=\sum_{i=jB}^{(j+1)B-1}\Delta W_i^{\mathrm{fine}}.$$

这是时间区间端点相减后的望远镜求和：中间的$W_t$互相消掉，只剩粗区间的总变化。细增量相互独立，每个方差为$h$，故粗增量方差为$Bh$，也与粗时间长度相符。

例如四个细增量为$(0.1,-0.2,0.3,0.4)\sqrt{\mathrm T}$，每两项合并得到$(-0.1,0.7)\sqrt{\mathrm T}$。两个列表的累计驱动都为$0.6\sqrt{\mathrm T}$。

<!-- practice: p16-brownian-merge -->

<!-- practice: p16-paired-refine -->

同一驱动也不会使两种离散状态完全相同。以一粗步含两细步为例，令$q=1-ah$，细步终点为

$$X_2=q^2X_0+\sigma(q\Delta W_0+\Delta W_1),$$

粗步终点则为

$$X_1^{\mathrm{coarse}}=(1-2ah)X_0+\sigma(\Delta W_0+\Delta W_1).$$

细网格在第一段随机变化后多执行了一次恢复，因而对$\Delta W_0$也多乘了$q$。把驱动对齐以后，这种差异才清楚地反映离散推进方式。若分别抽取粗、细噪声，终点差还会包含两条驱动本身的不同。

## 两T窗口的配对路径 {#paired-paths-over-two-time-units}

实验固定初态1 U、$a=0.7/\mathrm T$、$\sigma=0.25\,\mathrm U/\sqrt{\mathrm T}$，生成200个长度0.01 T的细增量，每4项合成一个长度0.04 T的粗增量。细路径含201个状态，粗路径含51个状态，两者都到达2 T。

比较时，粗路径第$j$个状态对应细路径第$4j$个状态，因为这两个下标指向同一物理时刻。

<!-- experiment: ed740407 figure -->

蓝线为细网格路径，粉色点线为合并驱动后的粗网格路径。它们随同一随机驱动起伏，终点绝对差约为0.005990 U。这个差比较两种数值近似；与连续精确路径的距离需要另有参照。

同一连续模型在终点的均值约为0.246597 U、方差约为0.041928 U²。这是独立重复后的分布特征，图中一条路径可以高于或低于均值。下一节将从连续方程和离散规则各自推导均值、方差，再用重复路径估计它们。

## 参考资料 {#references}

[Särkkä与Solin，Applied Stochastic Differential Equations](https://users.aalto.fi/~asolin/sde-book/sde-book.pdf)，布朗驱动、随机微分方程与Euler–Maruyama方法。
