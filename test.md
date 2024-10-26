
t = np.arange(24).reshape((4, 6))
print(t)
t1 = t.reshape((1, 24))
print(t1)

import pandas as pd
df = pd.read_csv('**')
print('', df.shape)
print('', df.columns)
print('', df.index)

import cv2 as cv
import matplotlib.pyplot as plt
img = cv.imread('**', 0)
plt.imshow(img)
plt.show()

import cv2
import numpy as np
import matplotlib.pyplot as plt
src = cv2.imread('./data-sets/fakeface.jpeg', cv2.IMREAD_UNCHANGED)
kernel = np.ones((3, 3), np.uint8)
result = cv2.morphologyEx(src, cv2.MORPH_CLOSE, kernel)
# 使用matplotlib显示图像
plt.imshow(result)
plt.show()