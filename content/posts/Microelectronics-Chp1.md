---
date: '2025-01-05T17:15:59+08:00'
title: 'Microelectronics Chapter 1 -- Introduction'
draft: false
cover:
  image: 'img/Microelectronics-Chp1/cover.png'
  alt: 'Microelectronics Chapter 1 -- Introduction'
params:
  math: true
tags: ['Microelectronics','Engineering']
categories: 'Notes'
description: 'Notes for Microelectronics'
summary: "Microelectronics Chapter 1 -- Introduction"
---


# Chapter 1 — Introduction

# Amplifier

## Circuits models for amplifiers

Voltage amplifier

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F.png)

Current amplifier

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8.png)

Transconductance amplifier

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%201.png)

Transresistance amplifier

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%202.png)

### Relationships

voltage-current

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%203.png)

voltage-transconductance

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%204.png)

voltage-transresistance

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%205.png)

# Frequency response:

### Low pass filter

### Circuit model:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%206.png)

Transfer function:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%207.png)

```python
import numpy as np
import matplotlib.pyplot as plt

f = np.linspace(0.1,10,50)
mag = lambda f: -20*np.log10(np.sqrt(1+f**2))
plt.plot(f,mag(f))
plt.xlabel(r'$\frac{w}{w_0}$')
plt.ylabel('Magnitude')
plt.show()
pha = lambda f: -np.arctan(f)*180/np.pi
plt.plot(f,pha(f))
plt.xlabel(r'$\frac{w}{w_0}$')
plt.ylabel('Phase')
plt.show()
```

![Untitled](/img/Microelectronics-Chp1/Untitled.png)

![Untitled](/img/Microelectronics-Chp1/Untitled%201.png)

### High pass filter

### Circuit model:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%208.png)

Transfer function:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%209.png)

```python
mag = lambda f: -20*np.log10(np.sqrt(1+(f**-2)))
plt.plot(f,mag(f))
plt.xlabel(r'$\frac{w}{w_0}$')
plt.ylabel('Magnitude')
plt.show()
pha = lambda f: np.arctan(f**-1)*180/np.pi
plt.plot(f,pha(f))
plt.xlabel(r'$\frac{w}{w_0}$')
plt.ylabel('Phase')
plt.show()
```

![Untitled](/img/Microelectronics-Chp1/Untitled%202.png)

![Untitled](/img/Microelectronics-Chp1/Untitled%203.png)

# STC circuit

## Source-free RC circuit

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F%201.png)

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2010.png)

Separable:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2011.png)

The voltage decays exponentially.

## Step response of RC circuit:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2012.png)

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2013.png)

Integrating factor method:

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F%202.png)

The result can be interpreted:

The voltage across the capacitor is the final voltage minus the difference beteen the final and initial voltage which decays exponentially.

# Semiconductor

### Intrinsic semiconductor:

Let n be the concentration of free electron, p be the concentration of the holes:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2014.png)

## Doped semiconductor:

## PN junction:

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F%203.png)

### Drift current:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2015.png)

Resistivity is given:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2016.png)

### Diffusion current:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2017.png)

### Einstein relationship:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2018.png)

### Built-in potential:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2019.png)

Derivation:

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F%204.png)

### Width of depletion region:

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F%205.png)

derivation:

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2020.png)

Halfway…

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2021.png)

Since voltage is continuous

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F%206.png)

### Charge stored in the depletion region(only one side)

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2022.png)

derivation:

![PNG影像.png](/img/Microelectronics-Chp1/PNG%25E5%25BD%25B1%25E5%2583%258F%207.png)

### Current-voltage relationship

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2023.png)

![電子學.png](/img/Microelectronics-Chp1/%25E9%259B%25BB%25E5%25AD%2590%25E5%25AD%25B8%2024.png)