---
date: '2025-01-05T17:15:59+08:00'
title: 'Linear algebra caclulator by C++'
draft: True
cover:
  image: 'img/linear_algebra_by_C++/cover.jpg'
  alt: 'linear algebra'
params:
  math: true
tags: ['Linear Algebra']
categories: 'Code'
description: 'Implementation of linear algebra calculator by C++'
summary: "Implementation of linear algebra calculator by C++"
weight: 20
---


This is a simple C++ program that can perform basic linear algebra operations based on the book **"Introduction to Linear Algebra"** by Professor **Gilbert Strang**. The program can handle operations such as matrix addition, subtraction, multiplication, transposition, and so on ...
有些網站
## Main function  
Main function that reads the user's choice and calls the corresponding function.
```cpp
int main(){
	cout<<"-----------Welcome-----------"<<endl;
	int select,n;
	print_manu(cout);
	matrix a,b;
	while(cin>>select){
		if(select==0)
			break;
		switch(select){
			case 1:
				cin>>a>>b;
				cout<<a+b;
				break;
			case 2:
				cin>>a>>b;
				cout<<a-b;
				break;
			case 3:
				cin>>a>>b;
				cout<<a*b;
				break;
			case 4:
				cin>>a;
				cout<<a.transpose();
				break;
			case 5:
				cin>>a;
				a.getlu(cout);
				break;
			case 6:
				cin>>a;
				a.getldu(cout);
				break;
			case 7:
				cin>>a;
				cout<<a.inverse();
				break;
			case 8:
				cin>>a;
				cout<<"rank="<<a.rank()<<endl;
				break;
			case 9:
				cin>>a;
				cout<<"rref="<<endl<<a.get_rref()<<endl;
				break;
			case 10:
				cin>>a;
				cout<<"The column space is"<<endl<<"span"<<endl<<a.colspace()<<endl;
				break;
			case 11:
				cin>>a;
				cout<<"The nullspace is ";
				if(a.rank()==a.get_col())
					cout<<"Z"<<endl;
				else
					cout<<endl<<"span"<<endl<<a.nullspace()<<endl;
				break;
			case 12:
				cin>>a;
				cout<<"The row space is "<<endl<<"span"<<endl<<a.rowspace()<<endl;
				break;
			case 13:
				cin>>a;
				cout<<"The left nullspace is ";
				if(a.get_row()==a.rank())
					cout<<"Z"<<endl;
				else
					cout<<endl<<"span"<<endl<<a.leftnullspace()<<endl;
				break;
			case 14:
				cin>>a;
				a.getGQR(cout);
				break;
			case 15:
				cin>>a;
				a.getGSQR(cout);
				break;
			case 16:
				cin>>a;
				cout<<a.project();
				break;
			case 17:
				cin>>a;
				cout<<"det="<<a.det()<<endl;
				break;
			case 18:
				cin>>a;
				cout<<"The eigenvalues are "<<a.eigenvalue()<<endl;
				break;
			case 19:
				cin>>a;
				cout<<"The eigenvectors are "<<endl<<a.eigenvector()<<endl;
				break;
			case 20:
				cin>>a;
				a.getQ_lambda_QT(cout);
				break;
			case 21:
				cin>>a;
				a.getS_lambda_S1(cout);
				break;
			case 22:
				cin>>a;
				a.getsvd(cout);
				break;
			case 23:
				cin>>a;
				cout<<"Please input the rank you want to approximate"<<endl;
				cin>>n;
				cout<<a.rank_n_appr(n);
				break;
			case 24:
				cin>>a;
				cout<<a.pseudo_inverse()<<endl;
				break;
			case 25:
				cin>>a>>b;
				cout<<"x="<<endl<<Axb(a,b);
				break;
		}
		print_manu(cout);
	}
	cout<<"----------Thank you-------------"<<endl;
	return 0;
}
```


## Preprocessing  
Include the necessary libraries and define a two-dimensional vector type.
```cpp
#include<iostream>
#include<vector>
#include<math.h>
#include<iomanip>
#include<set>
using namespace std;
typedef vector< vector<double> > two_dvector;
```


## IO functions  
Operator overloading for input and output.
```cpp
/*input a matrix*/
istream& operator>>(istream& ins,matrix& a){
	cout<<"Input rows and columns of the matrix"<<endl;
	ins>>a.row>>a.col;
	a.co.resize(a.row);
	for(int i=0;i<a.co.size();i++)
		a.co[i].resize(a.col,0);
	cout<<"Please input a "<<a.row<<" by "<<a.col<<" matrix"<<endl;
	for(auto& r: a.co)
		for(auto& c:r)
			ins>>c;
	return ins;
}

/*output a two_dvector*/
ostream& operator<<(ostream& outs,const two_dvector& v){
	for(auto r : v){
		for(auto c : r)
			if(fabs(c)<0.0001)
				outs<<right<<setw(10)<<"0"<<" ";
			else
				outs<<right<<setw(10)<<c<<" ";
		cout<<endl;
	}
	return outs;	
}

/*output a set*/
ostream& operator<<(ostream& outs,const set<double,greater<double>> &s){
	for(auto x:s){
		if(fabs(x)<0.0001)
			outs<<"0"<<" ";
		else
			outs<<x<<" ";
	}
	cout<<endl;
	return outs;
}

/*output a matrix*/
ostream& operator<<(ostream& outs,const matrix& a){
	for(auto r : a.co){
		for(auto c : r)
			if(fabs(c)<0.0001)
				outs<<right<<setw(10)<<"0"<<" ";
			else
				outs<<right<<setw(10)<<c<<" ";
		cout<<endl;
	}
	return outs;	
}
```

## Get functions  
Use the above functiions to output results.
```cpp
void matrix::getlu(ostream& outs){
	lu();	
	if(per)
		outs<<"P= "<<endl<<permu<<endl;
	outs<<"A= "<<endl<<co<<endl;
	outs<<"L= "<<endl<<low<<endl;
	outs<<"U= "<<endl<<up<<endl;
}

void matrix::getldu(ostream& outs){
	ldu();
	if(per)
		outs<<"P= "<<endl<<permu<<endl;
	outs<<"A= "<<endl<<co<<endl;
	outs<<"L= "<<endl<<low<<endl;
	outs<<"D= "<<endl<<d<<endl;
	outs<<"U= "<<endl<<up<<endl;
}

void matrix::getQ_lambda_QT(ostream& outs){
	if(!is_square()){
		outs<<"Invalid input(Not square)"<<endl;
		return;
	}
	if(!is_symmetric()){
		outs<<"Invalid input(Not symmetric)"<<endl;
		return ;
	}
	Q_lambda_QT();	
	outs<<"Q="<<endl<<Q<<endl;
	outs<<"Λ="<<endl<<lambda<<endl;
	outs<<"QT="<<endl<<trans(Q)<<endl;
}

void matrix::getS_lambda_S1(ostream& outs){
	if(!is_square())
		return;
	S.clear();
	lambda.clear();
	eigenvector();
	lambda=resize(row,row);
	if(evector[0].size()!=row){
		outs<<"Not diagonalizable(Not enough eigenvector)"<<endl;
		return;
	}
	S_lambda_S1();		
	outs<<"S="<<endl<<S<<endl;
	outs<<"Λ="<<endl<<lambda<<endl;
	outs<<"S-1="<<endl<<inversev(S)<<endl;
}

void matrix::getsvd(ostream& outs){
	svd();
	outs<<"U="<<endl<<U<<endl;
	outs<<"Σ="<<endl<<sigma<<endl;
	outs<<"VT="<<endl<<trans(V)<<endl;
}
```

## Function declarations  
Declare some useful functions.
```cpp
/*functions*/
bool is_in(const vector<int>& v,int ele);/*get free columns*/

int sgn(long double);
void givens_rotation(double,double,long double&,long double&);

void print_manu(ostream& outs);
two_dvector resize(int r,int c);
```

## Function definitions  
Define the functions declared above.
```cpp
bool is_in(const vector<int>& v,int ele){
	for(auto x :v)
		if(x==ele)
			return true;
	return false;
}

int sgn(long double x){
	if(x>=0)
		return 1;
	return -1;
}

void givens_rotation(double a,double b,long double &c,long double &s){
	if(b==0){
		c=sgn(a);
        s=0;
	}
    else if(a==0){
    	c=0;
        s=sgn(b);
	}  
    else if(fabs(a)>fabs(b)){
    	long double tan=b/a;
        long double u=sgn(a)*sqrt(1+tan*tan);
        c=1/u;
        s=c*tan;
	}  
    else{
    	long double tan=a/b;
        long double u=sgn(b)*sqrt(1+tan*tan);
        s=1/u;
        c=s*tan;
	}
}

void print_manu(ostream& outs){
	outs<<"\n1:addition / 2:subtraction / 3:multication / 4:transpose  / 5:LU decomposition\n\n";
	outs<<"6:LDU decomposition / 7:inverse / 8:rank / 9:row reduced echelon form / 10:Column space\n\n";
	outs<<"11:Null space / 12:Row space / 13:Left null space / 14:QR decomposition(Givens rotation)\n\n";
	outs<<"15:QR decomposition(Gram-Schmidt method) / 16:projection / 17:determinant / 18:Eigenvalues\n\n";
	outs<<"19:Eigenvectors(If not symmetric due to numerical instability, this may have errors)\n\n";
	outs<<"20:Q Λ QT diagonalization(for symmetric matrix)\n\n";
	outs<<"21:S Λ S-1 diagonalization(Due to the numerical instability , this may have errors)\n\n";
	outs<<"22:Singular value decomposition / 23:Best rank n approximation / 24:Pseudo inverse\n\n";
	outs<<"25:Solving Ax=b\n\n";
	outs<<"Press 0 to quit"<<endl;
}
```

## Function for two_dvector
Define some functions for two_dvector. For inversiing a two_dvector, we first convert it to a matrix and then call the matrix's inverse function.
```cpp
two_dvector resize(int r,int c){
	two_dvector ans;
	ans.resize(r);
	for(int i=0;i<ans.size();i++)
		ans[i].resize(c,0);
	return ans;
}

void set_to_identity(two_dvector& v){
	for(int i=0;i<v.size();i++)
		for(int j=0;j<v[0].size();j++)
			v[i][j]=(i==j);
}

two_dvector trans(const two_dvector &v){
	two_dvector ans;
	ans=resize(v[0].size(),v.size());
	for(int i=0;i<v.size();i++)
		for(int j=0;j<v[0].size();j++)
			ans[j][i]=v[i][j];
	return ans;	
}
void normalize_col(two_dvector& v){
	v=trans(v);
	double length;
	for(int i=0;i<v.size();i++){
		length=0;
		for(int j=0;j<v[0].size();j++)
			length+=pow(v[i][j],2);
		length=sqrt(length);
		for(int j=0;j<v[0].size();j++)
			v[i][j]/=length;
	}
	v=trans(v);
}

void orthonormalize_col(two_dvector &v){
	v=trans(v);
	for(int i=1;i<v.size();i++)
		for(int j=i-1;j>=0;j--)
			v[i]=v[i]-((v[j]*v[i])/(v[j]*v[j]))*v[j];
	v=trans(v);
	normalize_col(v);
}



two_dvector inversev(const two_dvector &v){
	matrix temp(v.size(),v[0].size());
	temp.co=v;
	return temp.inverse().co;
}

bool matrix::is_square(){
	if(row==col)
		return true;
	return false;
}
bool matrix::is_symmetric(){
	if(this->co==this->transpose().co)
		return true;
	return false;
}
```

## Matrix class
Define the matrix class and its member functions.
```cpp
class matrix{
	private:
		two_dvector co;/*entry of the matrix*/
		int row;
		int col;
		two_dvector low;/*L*/
		two_dvector up;/*U*/
		two_dvector d;/*D*/
		two_dvector permu;/*P*/
		two_dvector inver;
		int per=0;/*times of permutations when doing LU*/
		two_dvector rref;/*row reduced echelon form*/
		int r=0;/*rank*/
		double determine;
		
		two_dvector GQ;/*Givens Q*/
		two_dvector GR;/*Givens R*/
		
		two_dvector GSQ;/*Gram-Schmidt Q*/
		two_dvector GSR;/*Gram-Schmidt R*/
		
		vector<int> pivot_col;/*pivot_col from rref*/
		vector<int> free_col;/*free_col from rref*/
		
		/*four fundamental subspaces*/
		two_dvector null_space;
		two_dvector col_space;
		two_dvector row_space;
		two_dvector left_null_space;
		
		set<double, greater<double> > evalue;/*eigenvalue(no repitition)*/
		vector<double> evaluev;/*eigenvalue(with possible repitition)*/
		two_dvector evector;/*eigenvector*/
		
		two_dvector Q;/*orthonormal matrix from Q �GN QT*/
		two_dvector lambda;/*diagonal matrix from Q �GN QT*/
		two_dvector S;/*S �GN S-1*/
		
		two_dvector U;/*U �GUVT in column space*/
		two_dvector sigma;/*singular value matrix*/
		two_dvector V;/*U �GUVT in row space*/
		
		/*helper function*/
		void sort_for_svd();
	public:
		/*constructor*/
		matrix();
		matrix(int r,int c);
		matrix(two_dvector& v);
		/*assignment operator*/
		void operator=(const matrix& a);
		
		/*functions for input and output*/
		friend istream& operator>>(istream& ins,matrix& a);
		friend ostream& operator<<(ostream& outs,const matrix& a);
		friend ostream& operator<<(ostream& outs,const two_dvector& a);
		friend ostream& operator<<(ostream& outs,const set<double,greater<double>> &s);
		void getlu(ostream& outs);
		void getldu(ostream& outs);
		void getGQR(ostream& outs);
		void getGSQR(ostream& outs);
		void getQ_lambda_QT(ostream& outs);
		void getS_lambda_S1(ostream& outs);
		void getsvd(ostream& outs);
		
		/*operator for(+, -, *)*/
		/*matrix,matrix*/
		friend matrix operator+(const matrix& a,const matrix& b);
		friend matrix operator-(const matrix& a,const matrix& b);
		friend matrix operator*(const matrix& a,const matrix& b);
		
		/*two_dvector,two_dvector*/
		friend two_dvector operator+(const two_dvector&,const two_dvector&);
		friend two_dvector operator-(const two_dvector&,const two_dvector&);
		friend two_dvector operator*(const two_dvector&,const two_dvector&);
		
		
		/*vector,vector*/
		friend vector<double> operator+(const vector<double>&,const vector<double>&);
		friend vector<double> operator-(const vector<double>&,const vector<double>&);
		friend double operator*(const vector<double>&,const vector<double>&);
		
		/*const*/
		friend matrix operator*(const double&,const matrix&);
		friend vector<double> operator*(const double&,const vector<double>&);
		friend vector<double> operator/(const vector<double>&,const double&);
		
		/*two_dvector,vector*/
		friend vector<double> operator*(const two_dvector&,const vector<double>&);
		
		/*functions for two_dvector*/
		
		friend void set_to_identity(two_dvector& v);
		friend two_dvector trans(const two_dvector &v);
		friend void normalize_col(two_dvector& v);
		friend void orthonormalize_col(two_dvector& v);
		
		friend two_dvector inversev(const two_dvector& v);
		bool is_square();
		bool is_symmetric();
		
		/*functions for matrix*/
		int get_row();
		int get_col();
		
		void lu();
		void ldu();
		matrix transpose() const;
		matrix inverse();
		matrix get_rref();
		int rank();
		matrix project();
		double det();
		/*subspaces and orthogonolization*/
		two_dvector nullspace();
		two_dvector rowspace();
		two_dvector colspace();
		two_dvector leftnullspace();
		void GQR();
		void GSQR();
		
		/*eigenvalue and diagonalization*/
		set<double, greater<double> > eigenvalue();
		two_dvector eigenvector();
		void Q_lambda_QT();
		void S_lambda_S1();
		void svd();
		/*approximation*/
		matrix rank_n_appr(int n);
		/*Pseudo inverse*/
		matrix pseudo_inverse();
		/*last fundamental problem*/
		friend matrix Axb(matrix& a,matrix& b);
		/* condition number */
		double con_num();
		/*destructor*/
		~matrix();
};
```
