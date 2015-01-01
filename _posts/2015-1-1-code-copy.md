---
layout: post
title: 自定义HTML滚动条
category: WEB
published: true
---
{{ page.title }}
====
{{ page.date | date_to_string }} in Guang'zhou, China
{% highlight css %}
body{
/	overflow-x:hidden;
	scrollbar-face-color:#55e7ca;
	scrollbar-3dlight-color:#81eed8;
	scrollbar-highlight-color:#98f1df;
	scrollbar-track-color:#6b6b6b;
	scrollbar-arrow-color:#fff;
	scrollbar-shadow-color:#28e1bd;
	scrollbar-dark-shadow-color:#1dd2af
}
/**
 * scroll bar style
 **/
::-webkit-scrollbar{width:7px;height:7px}
::-webkit-scrollbar-track{background:#6b6b6b}
::-webkit-scrollbar-thumb{background:#148f77;border-radius:0}
::-webkit-scrollbar-thumb:hover{background:#17a689;cursor:pointer}
::-webkit-scrollbar-thumb:active{background:#117964}

{% endhighlight %}

