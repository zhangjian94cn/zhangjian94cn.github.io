
1. 创建数组t，其元素从0到23
```py
import numpy as np
t = np.arange(24).reshape((4, 6))
print(t)
t1 = t.reshape((1, 24))
print(t1)
```

2. 使用pandas读取csv
```py
import pandas as pd
# 读取CSV文件
df = pd.read_csv('./data-sets/loan_apply.csv')
print('数据表格的行数和列数为:', df.shape)
print('数据表格的列名为:', df.columns)
print('数据表格的索引行标签为:', df.index)
```

3. 使用opencv对图像进行侵蚀操作
```py
import cv2
import numpy as np
import matplotlib.pyplot as plt
if __name__ == "__main__":
    img = cv2.imread("./data-sets/head.jpg")
    img = 255 - img
    ret, img = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    # 设置卷积核
    kernel = np.ones((5, 5), dtype=np.uint8)
    # 膨胀操作
    img_dilate = cv2.dilate(img, kernel, iterations=2)
    # 腐蚀操作
    img_erode = cv2.erode(img, kernel, iterations=2)
    # 将原始图像、膨胀后的图像和腐蚀后的图像水平堆叠
    img_result = np.hstack([img, img_dilate, img_erode])
    # 显示结果
    plt.imshow(img_result)
    plt.show()
```

4. 对灰度图像进行读取、显示
```python
import cv2 as cv  # 使用opencv库
import matplotlib.pyplot as plt  # 导入matplotlib的pyplot模块
# 图像的地址
location = "./data-sets/nvpai.jpg"
# 以灰度图像读取
image1 = cv.imread(location, 0)
# 将图像展示出来
plt.imshow(image1)
plt.show()
```

5. 对图像进行闭运算操作
```py
import cv2
import numpy as np
import matplotlib.pyplot as plt
src = cv2.imread('./data-sets/fakeface.jpeg', cv2.IMREAD_UNCHANGED)
kernel = np.ones((3, 3), np.uint8)
result = cv2.morphologyEx(src, cv2.MORPH_CLOSE, kernel)
# 使用matplotlib显示图像
plt.imshow(result)
plt.show()
```

6. 使用opencv进行边缘检测，绘制轮廓
```py
import numpy as np
import cv2
import matplotlib.pyplot as plt
# 读取图片
img = cv2.imread('data-sets/test.jpg')
# 使用Canny边缘检测算法进行边缘检测
binary_img = cv2.Canny(img, 50, 200)
# 查找轮廓
h = cv2.findContours(binary_img, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
# 获取轮廓列表
contours = h[0]
# 在原图上画出轮廓
cv2.drawContours(img, contours, -1, (0, 255, 0), 3)
# 使用matplotlib显示图像
plt.imshow(img)
plt.show()
```

7. 使用TensorFlow构建神经网络模型，build_flatten
```python
import tensorflow as tf

model = tf.keras.models.Sequential(name="build_Flatten")
model.add(tf.keras.layers.Flatten(name="Flatten"))
model.build(input_shape=(4,4))

model.summary()
```

8. 使用opencv在灰度图像画点和圆
```python
import numpy as np
import cv2 as cv
import matplotlib.pyplot as plt

img = np.zeros((320, 320, 3), np.uint8)  # 生成一个空灰度图像
point_color = (0, 0, 255)  # BGR

points_list = [(160, 160), (136, 160), (150, 200),
               (200, 180), (120, 150), (145, 180)]

for point in points_list:
    cv.circle(img, point, 1, point_color, thickness=-1, lineType=cv.LINE_4)

cv.circle(img, (160, 160), 60, point_color, thickness=1, lineType=cv.LINE_4)

plt.imshow(img)
plt.show()
```

9. 使用opencv在灰度图像中画一条直线
```py
import numpy as np
import cv2 as cv
import matplotlib.pyplot as plt

img = np.zeros((320, 320, 3), np.uint8)  # 生成一个空灰度图像
ptStart = (60, 60)  # 起点和终点的坐标
ptEnd = (260, 260)
point_color = (0, 255, 0)  # BGR
thickness = 1
lineType = 4

cv.line(img, ptStart, ptEnd, point_color, thickness, lineType)
plt.imshow(img)
plt.show()
```


10. 使用opencv进行膨胀操作（五角星）
```py
import cv2
import numpy as np
import matplotlib.pyplot as plt

# 获取文件夹中的某张图
img = cv2.imread('./data-sets/star.jpg')

# 显示图片
plt.imshow(img)

# (2)膨胀操作
# 设置卷积核3*3全1
kernel = np.ones((3,3), np.uint8)

# 传入图像，卷积核，迭代次数
img3 = cv2.dilate(img, kernel, iterations=1)

# 显示图片
plt.imshow(img3)
```

11. 张量的逐元素乘法
```python
import tensorflow as tf

a = [[1, 2], [3, 4]]
b = [[1, 1], [1, 1]]
print(tf.multiply(a, b))
```

12. 使用TensorFlow构建神经网络模型，build_APool，（卷积层，池化层）
```py
import tensorflow as tf

model = tf.keras.models.Sequential(name='build_APool')
model.add(tf.keras.layers.Conv2D(filters=7, kernel_size=(5,5), padding='same', input_shape=(64,64,3), name='conv2D'))
model.add(tf.keras.layers.AveragePooling2D(pool_size=(2,2), strides=2, padding='valid', name='APool'))

model.summary()
```

13. 逻辑回归算法，红酒档次
```py
# 加载数据集
from sklearn import datasets
wine = datasets.load_wine()
X = wine.data
Y = wine.target

# 划分特征和标签数据
from sklearn.model_selection import train_test_split
x_train, x_test, y_train, y_test = train_test_split(X, Y, test_size=0.1, random_state=2)

# 构建模型
from sklearn.linear_model import LogisticRegression
model = LogisticRegression()

# 模型训练
model.fit(x_train, y_train)

# 模型预测
y_pre = model.predict(x_test)
print(y_pre)
```

14. 使用TensorFlow构建神经网络模型，build_conv，（卷积）
```python
import tensorflow as tf
from tensorflow.keras.layers import Conv2D

model = tf.keras.models.Sequential(name='build_conv')
model.add(Conv2D(filters=6, kernel_size=(5,5), padding='same', input_shape=(64,64,3), name='conv2D'))

model.summary()
```

15. knn分类包
```py
from sklearn.neighbors import KNeighborsClassifier
import numpy as np

x = np.array([
    [1, 1],
    [1, 1.5],
    [2, 2.5],
    [2.5, 3],
    [1.5, 1],
    [3, 2.5]
])

y = ['A', 'A', 'B', 'B', 'A', 'B']

# KNN三要素
model = KNeighborsClassifier(n_neighbors=3)
model.fit(x, y)

print(model.predict([[1.25, 1.25]]))
```

16. 对图像提取红绿蓝
```py
import matplotlib.pyplot as plt
import cv2
import numpy as np

img = cv2.imread('./data-sets/fish.jpg')
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)  # HSV空间

lower_blue = np.array([110, 100, 100])  # blue
upper_blue = np.array([130, 255, 255])

lower_green = np.array([60, 100, 100])  # green
upper_green = np.array([70, 255, 255])

lower_red = np.array([0, 100, 100])  # red
upper_red = np.array([10, 255, 255])

red_mask = cv2.inRange(hsv, lower_red, upper_red)  # 取红色
blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)  # 蓝色
green_mask = cv2.inRange(hsv, lower_green, upper_green)  # 绿色

red = cv2.bitwise_and(img, img, mask=red_mask)  # 对原图像处理
green = cv2.bitwise_and(img, img, mask=green_mask)
blue = cv2.bitwise_and(img, img, mask=blue_mask)

res = green + red + blue
plt.imshow(res)
plt.show()
```

