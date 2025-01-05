---
date: '2025-01-05T17:15:59+08:00'
title: 'Signal and System'
draft: false
cover:
  image: 'img/signal_and_system/cover.jpg'
  alt: 'Signal and System'
params:
  math: true
tags: ['Signal and System','Engineering']
categories: 'Notes'
description: 'Note for signal and system'
summary: "Signal and System"
---

 
修課學期: 2023 Spring  

# Table of contents

- [Introduction](#introduction)
- [Convolution](#convolution)
- [Differential and difference equation](#differential-and-difference-equation)
- [Fourier representation](#fourier-representation)
- [Property of FT](#property-of-ft)
- [Application of FT](#application-of-ft)
- [Sampling](#sampling)

# Introduction

## Operation on signal (independent variable)

### Scaling:

Generally, if \(y(t)=x(at)\), the ticks of the original graph is multiplied by \(\frac{1}{a}\).

### Shifting:

Generally, if \(y(t)=x(t-t_0)\), \(y(t)\) delays \(x(t)\) by \(t_0\), the ticks of the original graph is added by \(t_o\).

### Mixing up:

first shift, then scale.

## Impulse function

### Dirac-delta function (continuous)

$$
\delta(x) = 0 \; if x \neq0
$$

![Untitled](/img/signal_and_system/Untitled.png)

### Kronecker-delta function (discrete)

$$
\delta[n] = \begin{cases}      
0 & \text{if } n \neq 0 \\      1 & \text{if } n = 0      \end{cases}
$$

![Untitled](/img/signal_and_system/Untitled-1.png)

### Properties

![Untitled](/img/signal_and_system/Untitled-2.png)

## Properties of a signal

### Time invariance:

A system is time invariant if time delay or advance of the input signal leads to an identical time shift in he output signal.

![Untitled](/img/signal_and_system/Untitled-3.png)

### Linearity:

A system is linear if it satisfies **superposition** and **homogeneity**. 

# Convolution

![Untitled](/img/signal_and_system/Untitled-4.png)

- a discrete signal can be a weighted sum of impulse signal

## LTI system

![Untitled](/img/signal_and_system/Untitled-5.png)

- Output is a weighted sum of time-shifted impulse signal

Hence, we define convolution

$$
y[n] = x[n]*h[n]=\sum_{k=-\infty}^{\infty}x[k]h[n-k]
$$

$$
y(t) = x(t)*h(t)=\int_{k=-\infty}^{\infty}x(\tau)h(t-\tau)d\tau
$$

where \(h[n],h(t)\) is the impulse response of the system.

## Interconnection of LTI system

### Parallel connection

![Untitled](/img/signal_and_system/Untitled-6.png)

### Cascade connection

![Untitled](/img/signal_and_system/Untitled-7.png)

## Step response

### discrete case

- step response is the running sum of its impulse response

$$
s[n] = h[n]*u[n] = \sum_{k=-\infty}^{\infty}h[k]u[n-k]=\sum_{k=-\infty}^nh[k]
$$

$$
h[n]=\sum_{k=-\infty}^nh[n]-\sum_{k=-\infty}^{n-1}h[n] = s[n]-s[n-1]
$$

### continuous case

- replace the summation with integration, difference equation to differential equation

$$
s(t)=\int_{-\infty}^th(\tau)d\tau
$$

$$
h(t)=\frac{d}{dt}s(t)
$$

# Differential and difference equation

 

$$
y(t) = y^n(t)+y^f(t)
$$

- natural response: associated with initial condition with input \(x(t)=0\(
- force response: associated with input with initial condition = 0

## Natural response

### Differential

$$
\sum_{k=0}^Na_k\frac{d^k}{dt^k}y^n(t)=0
$$

this is a N order differential equation.

set:

$$
y^n(t) = e^{rt}
$$

This assumption is based on that it is the eigenfunction of the differential equation.

we get the characteristic equation:

$$
\sum_{k=0}^Na_kr^k=0
$$

solving it we get root \(r_i\),  the natural response is the linear combination of the eigenfunction

$$
y^n(t) = \sum_{i=0}^Nc_ie^{r_it}
$$

where \(c_i\) is given by initial condition.

![Untitled](/img/signal_and_system/Untitled-8.png)

### Difference

$$
\sum_{k=0}^Na_ky[n-k]=0
$$

set:

$$
y^n[n] = r^N
$$

This assumption is based on that it is the eigenfunction of the difference equation.

we get the characteristic equation:

$$
\sum_{k=0}^Na_kr^{N-k}=0
$$

solving it we get root \(r_i\), the natural response is the linear combination of the eigenfunction

$$
y^n[n] = \sum_{i=0}^Nc_ir_i^n
$$

where \(c_i\) is given by initial condition.

![Untitled](/img/signal_and_system/Untitled-9.png)

## Force response

Assuming the initial condition are zero, it consists of:

1. Same form as the natural response
2. a particular solution (assuming output has the same general form as the input did)

$$
force \; response = natural\; response + particular\;solution
$$

note: 

1. if 1 and 2 has the same form, we multiply t or n to 2 such that 2 is not included in the natural response (linearly independent).
2. the coefficient of the natural response is set by assuming the initial condition is zero  
    
    ![Untitled](/img/signal_and_system/Untitled-10.png)
    

## Complete solution

$$
complete \; solution = natural \;response+ force \; response
$$

we can solve the complete solution by solving natural response and force response separately, but we find the coefficient of the natural response twice, we can speed up a little bit……

- find the complete solution by getting initial condition right to the force response

![Untitled](/img/signal_and_system/Untitled-11.png)

### Example: find impulse response

the impulse function is hard to characterize as a input function, hence, we first find the step response then differentiate it.

![Untitled](/img/signal_and_system/Untitled-12.png)

# Fourier representation

## Introduction

Given the input:

$$
x[n] = e^{j\Omega n}  = cos(\Omega n)+jsin(\Omega n)
$$

the output is:

$$
y[n] = \sum_{k=-\infty}^\infty h[k]x[n-k]=\sum_{k=-\infty}^\infty h[k] e^{j\Omega (n-k)} =  e^{j\Omega n}\sum_{k=-\infty}^\infty h[k]e^{-j\Omega k} \\= e^{j\Omega n}H(e^{\Omega n})
$$

where:

$$
H(e^{j\Omega }) = \sum_{k = -\infty}^\infty h[k]e^{-j\Omega k}
$$

continuous case:

$$
H(e^{j\omega }) = \int_{-\infty}^\infty h(\tau)e^{-j\omega \tau}d\tau
$$

Hence, knowing the impulse response, we can derive the frequency response.

### Properties:

1. \(H(e^{j\Omega})\) is a function of \(\Omega\), with period of \(2\Omega\),  and it is complex in general
2. \(H(e^{j\Omega})\) is called “frequency response”, it can be written as \(H(e^{j\Omega}) = \alpha_i(\Omega)e^{j\beta_i\Omega}\), where \(\alpha_i\)  is the amplitude, and \(\beta_i\) is the phase.

### Why \(x[n] = e^{j\Omega n}\)?

![Untitled](/img/signal_and_system/Untitled-13.png)

\(x[n] = e^{j\Omega n}\) is the eigenfunction of the above equation, which is the output of a LTI system (also defined as a convolution operation), and all function can be represented as a linear combination of the eigenfunction ,this is where Fourier series comes in. Every function is composed of linear combination of \(x[n] = e^{j\Omega n}\), where \(\Omega\)  can be different, that is to say, the dimension of the basis is infinite. And the output is just change the amplitude and phase of the input signal.

![Untitled](/img/signal_and_system/Untitled-14.png)

## Four types of Fourier representation

![Untitled](/img/signal_and_system/Untitled-15.png)

For periodic signal, there will be fundamental frequency, the frequency of the eigenfunction will be the multiple of fundamental frequency, so the frequency domain is discrete. 

For aperiodic signal, on the contrary, the frequency domain is continuous, since the fundamental frequency approaches to zero.

For discrete signal, the signal is sampled, so the frequency is periodic (some information is lost)

For continuous signal, the frequency is aperiodic.

## DTFS (discrete time Fourier series)

$$
x[n] = \sum_{k=0}^{N-1}x[k]e^{jk\Omega_0n}\\
X[k] = \frac{1}{N}\sum_{n=0}^{N-1}x[n]e^{-jk\Omega_0n}
$$

where the fundamental frequency: \(\Omega_0 = \frac{2\pi}{N}\) where N is the fundamental period.

### DTFS of periodic impulse signal

![Untitled](/img/signal_and_system/Untitled-16.png)

### DTFS of square wave

![Untitled](/img/signal_and_system/Untitled-17.png)

## FS (Fourier series)

$$
x(t) = \sum_{k = -\infty}^\infty X[k]e^{jk\omega_0t}\\
X[k] = \frac{1}{T}\int_0^Tx(t)e^{-jk\omega_0t}dt
$$

### FS of square wave

![Untitled](/img/signal_and_system/Untitled-18.png)

where:

$$
sinc(x) = \begin{cases}      \frac{\sin(\pi x)}{\pi x} & \text{if } x \neq 0 \\      1 & \text{if } x = 0      \end{cases}
$$

## DTFT (discrete time Fourier transform)

$$
x[n] = \frac{1}{2\pi}\int_{-\pi}^\pi X(e^{j\Omega})e^{j\Omega n}d\Omega\\
X(e^{j\Omega}) = \sum_{n = -\infty}^\infty x[n]e^{-j\Omega n}
$$

### Example: \(x[n] = \alpha^nu[n]\)

![Untitled](/img/signal_and_system/Untitled-19.png)

what to do if \(\alpha \geq1\)? Z transform!

### DTFT of rectangle impulse

![Untitled](/img/signal_and_system/Untitled-20.png)

## FT (Fourier transform)

$$
x(t)= \frac{1}{2\pi}\int_{-\infty}^\infty X(j\omega)e^{j\omega t}d\omega\\
X(j\omega)=\int_{-\infty}^\infty x(t)e^{-j\omega t}dt
$$

### Example \(x(t) = e^{-\alpha t}u(t)\)

![Untitled](/img/signal_and_system/Untitled-21.png)

### FT of rectangle impulse

![Untitled](/img/signal_and_system/Untitled-22.png)

# Property of FT

## Symmetry property

1. time domain real ↔ frequency domain complex-conjugate symmetric
2. time domain even ↔ frequency domain even

### proof 1

![Untitled](/img/signal_and_system/Untitled-23.png)

### proof 2

![Untitled](/img/signal_and_system/Untitled-24.png)

## Convolution property

$$
y(t)=h(t)*x(t) \underset{FT}\leftrightarrow Y(j\omega) = X(j\omega)H(j\omega)
$$

Time domain convolution corresponds to frequency domain multiplication

### proof

![Untitled](/img/signal_and_system/Untitled-25.png)

## Modulation property

$$
y(t)=x(t)z(t) \underset{FT}\leftrightarrow Y(j\omega) = \frac{1}{2\pi}X(j\omega)*Z(j\omega)
$$

$$
y[n] = x[n]z[n] \underset{DTFT}\leftrightarrow Y(e^{j\Omega})=\frac{1}{2\pi}X(e^{j\Omega}) \circledast(e^{j\Omega})
$$

![Untitled](/img/signal_and_system/Untitled-26.png)

### Summary

![Untitled](/img/signal_and_system/Untitled-27.png)

## Duality

Given a FT pair,

$$
f(t)\underset{FT}\leftrightarrow F(j\omega) 
$$

interchange the role of and \(t,\omega\).

$$
F(jt)\underset{FT}\leftrightarrow 2\pi f(-\omega)
$$

![Untitled](/img/signal_and_system/Untitled-28.png)

- note: j in the function is ignored here since it is just a notation.

## Time-shift property

$$
x(t-t_0)\underset{FT}\leftrightarrow 
e^{-j\omega t_0}X(j\omega)
$$

Time shift corresponds to rotation in frequency domain.

![Untitled](Untitled 29.png)

## Frequency-shift property

$$
e^{j\omega_-t}x(t)\underset{FT}\leftrightarrow
X(j(\omega-\omega_0))
$$

Frequency shift corresponds to rotation in time domain.

![Untitled](/img/signal_and_system/Untitled-30.png)

## Scaling property

$$
x(at)\underset{FT}\leftrightarrow \frac{1}{|a|}X(j\frac{\omega}{a})
$$

![Untitled](/img/signal_and_system/Untitled-31.png)

## Parseval relationship

Energy in time domain = Energy in frequency domain

![Untitled](/img/signal_and_system/Untitled-32.png)

# Application of FT

## FT representation of FS

Represent the frequency domain of period signal in Fourier transform

### Conclusion

![Untitled](/img/signal_and_system/Untitled-33.png)

### Derivation

The FS of a period signal:

$$
x(t)=\sum_{k=-\infty}^\infty X[k]e^{jk \omega_{0} t}
$$

how about its FT?

![Untitled](/img/signal_and_system/Untitled-34.png)

$$
x(t)=\sum_{k=-\infty}^\infty X[k]e^{jk \omega_{0} t} \underset{FT}\leftrightarrow X(j\omega) = 2\pi\sum_{k=-\infty}^\infty X[k]\delta(\omega-k\omega_0)
$$

### Example: FT of \(x(t)=\cos(\omega_0t)\(

![Untitled](/img/signal_and_system/Untitled-35.png)

discrete signal works the same, just the notations are different.

### Convolution of periodic and aperiodic signal

The application of representation a periodic signal with its Fourier transform is that we can use the convolution property.

$$
y(t)=h(t)*x(t) \underset{FT}\leftrightarrow Y(j\omega) = X(j\omega)H(j\omega)
$$

$$
x(t)=\sum_{k=-\infty}^\infty X[k]e^{jk \omega_{0} t} \underset{FT}\leftrightarrow X(j\omega) = 2\pi\sum_{k=-\infty}^\infty X[k]\delta(\omega-k\omega_0)
$$

From the above two equations and shifting property of delta function, we can derive:

$$
y(t)=h(t)*x(t) \underset{FT}\leftrightarrow
2\pi\sum_{k=-\infty}^\infty X[k]\delta(\omega-k\omega_0)H(j\omega)\\
 = 2\pi\sum_{k=-\infty}^\infty X[k]H(jk\omega_0)\delta(\omega-k\omega_0)
$$

### Modulation of periodic and aperiodic signal

The application of representation a periodic signal with its Fourier transform is that we can use the modulation property.

$$
y(t) = g(t)x(t)\underset{FT}\leftrightarrow Y(j\omega) = \frac{1}{2\pi}G(j\omega)*X(j\omega)
$$

Result:

$$
Y(j\omega) = \sum_{k=-\infty}^\infty X[k]G(j(\omega-k\omega_0))
$$

proof:

![Untitled](/img/signal_and_system/Untitled-36.png)

## Amplitude modulation

Modulation

$$
r(t) = m(t)\cos(\omega_ct)
$$

![Untitled](/img/signal_and_system/Untitled-37.png)

Demodulation

$$
g(t) = r(t)\cos(\omega_ct)
$$

![Untitled](/img/signal_and_system/Untitled-38.png)

## Relating FT to DTFT

We have discussed the relationship between Fourier series and Fourier transform (aperiodic signal to periodic signal). Here, we discuss FT and DTFT, which has something to do with sampling.

$$
x(t) = e^{j\omega t}\\
g[n] = e^{j\Omega n}
$$

Suppose we force \(g[n] = x(nT_s)\) where \(T_s\) is the sampling period.

$$
e^{j\Omega n} = e^{j\omega(nT_s)}\\
\Omega = \omega T_s
$$

\(\Omega\) is fixed to the multiple of \(T_s\).

The DTFT of the signal is:

$$
X(e^{j\Omega}) = \sum_{n = -\infty}^\infty x[n]e^{-j\Omega n}
$$

plug \(\Omega = \omega T_s\):

$$
X_\delta({j\omega}) = \sum_{n = -\infty}^\infty x[n]e^{-j\omega T_sn}
$$

This is the FT of the “sampled” signal.

Why sampled? Derive its time domain representation:

$$
\delta(t) \underset{FT}\leftrightarrow 1\\
\delta(t-nT_s) \underset{FT}\leftrightarrow e^{-j\omega T_sn}\\
x_\delta(t) = \sum_{n = -\infty}^\infty x[n]\delta(t-nT_s)
$$

This is intuitive!

In summary, we are dealing with converting a discrete signal to continuous signal.

# Sampling

This section deals with converting a signal from a continuous time \(x_\delta(t)\) to discrete time (\(x[n]\)).

$$
x_\delta(t) = \sum_{n = -\infty}^\infty x[n]\delta(t-nT_s) = x_\delta(t) = \sum_{n = -\infty}^\infty x(nT_s)\delta(t-nT_s)\\
 = \sum_{n = -\infty}^\infty x(t)\delta(t-nT_s) = x(t)\sum_{n = -\infty}^\infty \delta(t-nT_s) = x(t)p(t)
$$

where

$$
p(t) = \sum_{n = -\infty}^\infty \delta(t-nT_s)
$$

is the **impulse train**.

Let’s find the FT representation of \(p(t)\).

![Untitled](/img/signal_and_system/Untitled-39.png)

### Conclusion

The FT of the sampled signal is given by an infinite sum of shifted versions of \(X(j\omega)\).

$$
x_\delta(t) = x(t)\sum_{n = -\infty}^\infty \delta(t-nT_s) = x(t)p(t)\\
X_\delta(j\omega) = \frac{1}{T_s}\sum_{k = -\infty}^{\infty}X(j(\omega-k\omega_s))
$$
