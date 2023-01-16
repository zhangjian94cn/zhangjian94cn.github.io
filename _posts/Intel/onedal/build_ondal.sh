_oneDalHome=/home/zhangjian/code/oneDAL
_intelOneapiHome=/opt/intel/oneapi


conda create -n onedal python=3.8 -y && \
conda activate onedal && \
conda install -y impi-devel cython jinja2 numpy clang-tools pybind11 -c intel -c conda-forge && \
conda install -y openjdk=11.0.13

#Find dpcpp, which is necessary for target onapi
source $_intelOneapiHome/compiler/latest/env/vars.sh
if [ ! command -v dpcpp &> /dev/null ]; then
	echo "dpcpp is not installed properly, please check the install path"
	exit
fi

#Setup mklgpufpk
_mklgpuPATH=$_oneDalHome/__deps/mklgpufpk
export CPATH=$_mklgpuPATH/lnx/include:$CPATH

##Find or install mklgpufpk
if [ -d $_mklgpuPATH ]; then
	echo "mklgpu found!"
else
	$_oneDalHome/dev/download_micromkl.sh
fi

#Setup tbb
_tbbPATH=$_oneDalHome/__deps/tbb
#export CPATH=$_tbbPATH/lnx/include:$CPATH

##Find or install tbbfpk
if [ -d $_tbbPATH ]; then
	echo "tbb found!"
else
	$_oneDalHome/dev/download_tbb.sh
fi

#Setup openjdk path
#Which is necessary for daal
export CPATH=/opt/conda/envs/onedal/include/linux:/opt/conda/envs/onedal/include:$CPATH

cd $_oneDalHome;
make daal -j$(expr $(nproc) - 1)  PLAT=lnx32e
