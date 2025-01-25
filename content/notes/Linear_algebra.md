---
date: '2025-01-05T17:15:59+08:00'
title: 'Linear Algebra'
draft: false
cover:
  image: 'img/linear_algebra/cover.jpg'
  alt: 'Linear algebra'
params:
  math: true
tags: ['Linear Algebra']
categories: 'Notes'
description: 'Note for Linear algebra'
summary: "Linear algebra"
---

# Brief review

## Matrix multiplication

左row右col

### row picture

![Untitled](/img/linear_algebra/Untitled.png)

![Untitled](/img/linear_algebra/Untitled-1.png)

where a and b are 1 by n row vectors

### column picture

![Untitled](/img/linear_algebra/Untitled-2.png)

![Untitled](/img/linear_algebra/Untitled-3.png)

where a and b are n by 1 column vectors.

先往row看再往col看

col*row than add.

## Eigenvalue and eigenvector

$$
A\cdot \pmb{v}= \lambda \cdot \pmb{v}
$$

where \(\lambda\)  is the eigenvalue, and \(\pmb{v}\) is the eigenvector.

for \(\lambda =0\), the corresponding eigenvectors are in the nullspace.

### Matrix diagonalization

Suppose A (n by n) has n independent eigenvectors, then we can diagonize A:

$$
A = S\Lambda S^{-1}
$$

note: not all A has this decomposition.

![Untitled](/img/linear_algebra/Untitled-4.png)

### Symmetric matrix

Eigenvectors can be chosen orthonormal, and there is only real eigenvalue.

![Untitled](/img/linear_algebra/Untitled-5.png)

if A is symmetric, the diagonalization becomes:

$$
A = S\Lambda S^{-1} = Q\Lambda Q^{-1} =  Q\Lambda Q^{T}
$$

- note:  \(Q^{-1} = Q^T\) for orthonormal matrix.

### Hermitian matrix

$$
A = A^H\:or\:
A_{ij} = A_{ji}^{*} 
$$

where \(()^*\) means complex conjugate.

A has n **orthonormal** eigenvectors.

### Unitary matrix

$$
U^HU=I
$$

### Decomposition of Hermitian matrix

For any x with length 1:

$$
\lambda_{min} \leq x^HAx \leq \lambda_{max}
$$

![Untitled](/img/linear_algebra/Untitled-6.png)

## SVD (singular value decomposition)

$$
A = UDV^H
$$

where U is a m by m matrix;

D is a m by n matrix;

V is a n by n matrix.

### Some proofs:

![Untitled](/img/linear_algebra/Untitled-7.png)

