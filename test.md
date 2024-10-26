
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