# 图标说明

请在此目录下放置以下尺寸的图标文件：

- `icon16.png` - 16x16 像素
- `icon48.png` - 48x48 像素
- `icon128.png` - 128x128 像素

## 图标设计建议

- 使用简洁的图标设计
- 建议使用工作流、数据聚合相关的图标元素
- 保持良好的辨识度

## 在线图标生成工具

如果你没有图标，可以使用以下在线工具生成：

1. **Favicon Generator**: https://favicon.io/
2. **Icon Generator**: https://www.iconfinder.com/
3. **Canva**: https://www.canva.com/

## 临时解决方案

在开发阶段，如果暂时没有图标，可以：

1. 使用简单的纯色方块
2. 从开源图标库下载（如 Font Awesome）
3. 使用 Emoji 转换为图片

## 快速生成命令（需要 ImageMagick）

```bash
# 生成纯色占位图标
convert -size 16x16 xc:#667eea icon16.png
convert -size 48x48 xc:#667eea icon48.png
convert -size 128x128 xc:#667eea icon128.png
```

注意：在有正式图标之前，扩展功能仍然可以正常使用，只是图标显示为默认样式。
