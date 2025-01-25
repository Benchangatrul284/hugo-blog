---
date: '2025-01-05T17:15:59+08:00'
title: 'ICLAB to IC Contest'
draft: false
params:
  math: true
tags: ['IC Contest']
categories: 'Notes'
description: 'Environment setup for ICLAB to IC Contest'
summary: "Environment setup for ICLAB to IC Contest"
---

### Open Server
Paste the following command in .tcshrc file
```bash
source /usr/cad/env.csh
setenv LD_LIBRARY_PATH $VERDI_HOME/share/PLI/IUS/LINUX64

setenv CBDK_PATH /usr/cad/CBDK_IC_Contest_v2.1
```

Type ```csh``` in the terminal to open csh shell.
### Clone your ICLAB repository
```bash
git clone https://github.com/Benchangatrul284/NYCU_ICLAB
cd NYCU_ICLAB
rm -rf .git # optional
```

### Fix 00_TESTBED/makefile
1. Change ```VERDI=/usr/cad/synopsys/verdi/2019.06/``` to ```VERDI=/usr/cad/synopsys/verdi/2023.12/```
2. Change ```UMC018_SIM=~iclabTA01/umc018/Verilog/umc18_neg.v``` to ```UMC018_SIM=/usr/cad/CBDK_IC_Contest_v2.5/Verilog/tsmc13_neg.v``` 
3. Remove ```UMC018_IO_SIM=~iclabTA01/umc018/Verilog/umc18io3v5v.v```  
or use the following command:
```bash
cd Labxx
sed -i 's|VERDI=/usr/cad/synopsys/verdi/2019.06/|VERDI=/usr/cad/synopsys/verdi/2023.12/|' 00_TESTBED/makefile
# change this line:
sed -i 's|UMC018_SIM=~iclabTA01/umc018/Verilog/umc18_neg.v|UMC018_SIM=/usr/cad/CBDK_IC_Contest_v2.5/Verilog/tsmc13_neg.v|' 00_TESTBED/makefile
sed -i '/UMC018_IO_SIM=~iclabTA01\/umc018\/Verilog\/umc18io3v5v.v/d' 00_TESTBED/makefile
```

### Set up symbolic link for makefile
```bash
cd Labxx
ln -sf ../00_TESTBED/makefile 01_RTL/makefile # the relative path is from the link to the target
ln -sf ../00_TESTBED/makefile 02_SYN/makefile
ln -sf ../00_TESTBED/makefile 03_GATE/makefile
```
Make sure all makefiles are the same.
You can run 01(vcs) after this step. (not sure if other will work)

### Fix 02_SYN/.synopsys_dc.setup
Change the ```search_path```
```bash
set company "iclab"
set desinger "Student"

set search_path         " ./ \
			../01_RTL                     \
                        /usr/cad/CBDK_IC_Contest_v2.1/SynopsysDC/db/ \
                        /usr/cad/synopsys/synthesis/cur/libraries/syn/ \
                        /usr/cad/synopsys/synthesis/cur/dw "
set target_library      " slow.db" 
set link_library        " * $target_library dw_foundation.sldb standard.sldb "
set symbol_library      " *.sdb "
set synthetic_library   " dw_foundation.sldb "

set verilogout_no_tri true
set hdlin_enable_presto_for_vhdl "TRUE"
set sh_enable_line_editing true 
history keep 100
alias h history
```

### Fix 02_SYN/syn.tcl
Comment out the following line (not sure if this is ok)
```bash
# set_wire_load_model -name umc18_wl10 -library slow
# set_operating_conditions -min fast  -max slow
```

### Create folders for Reports and Netlists
```bash
cd 02_SYN
mkdir Report Netlist
```
You can run synthesis(./01_run_dc_shell) after this step.

### Create symbolic link netlists in 03_GATE
I am not sure if these two are enough.
```bash
cd 03_GATE
set top_design = 'SSC'
ln -s "../02_SYN/Netlist/${top_design}_SYN.v" "${top_design}_SYN.v"
ln -s "../02_SYN/Netlist/${top_design}_SYN.sdf" "${top_design}_SYN.sdf"
```
Creating symbolic link should be after synthesis. (any way around?)