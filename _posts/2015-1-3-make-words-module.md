---
layout: post
title: 给jekyll添加说说模块
place: in Guang'zhou, China
category: 技术
tag: [idea,tech]
published: true
---
jekyll会解析根目录和_post下的文件并解析成静态网页。

所以在根目录下新建words.html，这将是说说的显示页面。

给要定义为说说的post加上一个属性，暂且叫他module(模块)吧。我们默认所有没有module属性的post均是文章。module为'words'的则是说说。

接着，在index中根据module做筛选，无module或module为'article'的则是文章，给予显示。否则不予显示。

最后，编辑说说的显示页面words.html，利用同样的方法，module为'words'给予显示。否则不予显示。

这还只是个想法，还没实验，也不一定会去实现。


