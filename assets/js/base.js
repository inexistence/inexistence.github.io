jQuery.fn.rotate = function(angle,whence) { 
    var p = this.get(0); 
 
    // we store the angle inside the image tag for persistence  
    if (!whence) { 
        p.angle = ((p.angle==undefined?0:p.angle) + angle) % 360; 
    } else { 
        p.angle = angle; 
    } 
 
    if (p.angle >= 0) { 
        var rotation = Math.PI * p.angle / 180; 
    } else { 
        var rotation = Math.PI * (360+p.angle) / 180; 
    } 
    var costheta = Math.round(Math.cos(rotation) * 1000) / 1000; 
    var sintheta = Math.round(Math.sin(rotation) * 1000) / 1000; 
    //alert(costheta+","+sintheta);  
  
    if (document.all && !window.opera) { 
        var canvas = document.createElement('img'); 
 
        canvas.src = p.src; 
        canvas.height = p.height; 
        canvas.width = p.width; 
 
        canvas.style.filter = "progid:DXImageTransform.Microsoft.Matrix(M11="+costheta+",M12="+(-sintheta)+",M21="+sintheta+",M22="+costheta+",SizingMethod='auto expand')"; 
    } else { 
        var canvas = document.createElement('canvas'); 
        if (!p.oImage) { 
            canvas.oImage = new Image(); 
            canvas.oImage.src = p.src; 
        } else { 
            canvas.oImage = p.oImage; 
        } 
 
        canvas.style.width = canvas.width = Math.abs(costheta*canvas.oImage.width) + Math.abs(sintheta*canvas.oImage.height); 
        canvas.style.height = canvas.height = Math.abs(costheta*canvas.oImage.height) + Math.abs(sintheta*canvas.oImage.width); 
 
        var context = canvas.getContext('2d'); 
        context.save(); 
        if (rotation <= Math.PI/2) { 
            context.translate(sintheta*canvas.oImage.height,0); 
        } else if (rotation <= Math.PI) { 
            context.translate(canvas.width,-costheta*canvas.oImage.height); 
        } else if (rotation <= 1.5*Math.PI) { 
            context.translate(-costheta*canvas.oImage.width,canvas.height); 
        } else { 
            context.translate(0,-sintheta*canvas.oImage.width); 
        } 
        context.rotate(rotation); 
        context.drawImage(canvas.oImage, 0, 0, canvas.oImage.width, canvas.oImage.height); 
        context.restore(); 
    } 
    canvas.id = p.id; 
    canvas.angle = p.angle; 
    p.parentNode.replaceChild(canvas, p); 
} 
 
jQuery.fn.rotateRight = function(angle) { 
    this.rotate(angle==undefined?90:angle); 
} 
 
jQuery.fn.rotateLeft = function(angle) { 
    this.rotate(angle==undefined?-90:-angle); 
} 
$(document).ready(function() {
function getByClass(oParent, sClass) {
        var aEle=oParent.getElementsByTagName('*');
        var aResult=[];
        var re=new RegExp('\\b'+sClass+'\\b', 'i');
        for(var i=0;i<aEle.length;i++) {
                if(re.test(aEle[i].className)) {
                        aResult.push(aEle[i]);
                }
        }
        return aResult;
}
function getWinWidth() {
	if (window.innerWidth)
		winWidth = window.innerWidth;
	else if ((document.body) && (document.body.clientWidth))
		winWidth = document.body.clientWidth;
	if (document.documentElement  && document.documentElement.clientWidth) {
		winWidth = document.documentElement.clientWidth;
	}
	return winWidth;
}
function getWinHeight() {
	if (window.innerHeight)
		winHeight = window.innerHeight;
	else if ((document.body) && (document.body.clientHeight))
		winHeight = document.body.clientHeight;
	if (document.documentElement && document.documentElement.clientHeight) {
		winHeight = document.documentElement.clientHeight;
	}
	return winHeight;
}

var loading;
var container;
var full_img;
var header;
var overlay;
var about;
var index_nav;

function initView(){
	loading = document.getElementById("loading");
	container = document.getElementById("container");
	full_img = getByClass(document, "full-width");
	header = document.getElementById("header");
	overlay = document.getElementById("overlay");
	about = document.getElementById("about");
	index_nav = document.getElementById("index_nav");
}
initView();

function loadOK(){
	if(loading)
		loading.style.opacity = 0;
	if(container)
		container.style.opacity = 1;
}
loadOK();

function setOpacity(){
	var top = document.documentElement.scrollTop || document.body.scrollTop;
	if(header) {
		header.style.backgroundPosition="50% "+ (top/5) + "px";
	}
	if(about){
		about.style.opacity = 1 - ((top/1000) * 3.5);
	}
	if(overlay){
		// overlay.style.opacity = 1 + top/1000;
		// overlay.style.opacity = 0 + top/1000;
	}
	if(index_nav ){
		index_nav.style.opacity = top>200? 0 + 1:0;
	}
}

var resize = function(){
	var winWidth = getWinWidth();
	var winHeight = getWinHeight();
	//设full_img满框
	if(full_img){
		for(var i = 0; i < full_img.length; i++){
			full_img[i].style.width = winWidth+"px";
		}
	}
	//设置回到顶部位置
	if(index_nav){
		var left = 2528.5 - Number(winWidth);
		var right = 'auto';
		if(winWidth < 600 || (Number(left) > Number(winWidth))) {
			left = 'auto';
			right = '0px';
		} else {
			left = left + 'px';
		}
		index_nav.style.left = left;
		index_nav.style.right = right;
		index_nav.style.top = winHeight - 112 + "px";
	}
	//设置header满屏
	if(header) {
		var padding =(winHeight - 278)/2;
		header.style.paddingTop = header.style.paddingBottom = padding+"px";
	}

}

resize();
window.onresize = resize;

window.onscroll = function () { 
	setOpacity();
};
setOpacity();
	var rotate = 0;        //根据下面所有条件计算后旋转的真实值
	var clickTime = 0;     //左右切换旋转
	var randomAnim = 1;    //随机数初始值
	var toRota = 90;       //一次旋转的角度
	var randomBig = true;  //是否随机放大
	var randomTimes = 4;   //随机放大概率
	/*设置点击后一言变换*/
	$(".one-word-btn").click(function(event){
		var animItem = $("#one-word-btn");
		if(randomBig)randomAnim = Math.floor(Math.random()*randomTimes);
		if(randomAnim!=0){
			if(clickTime==0){
				clickTime = 1;
				rotate = Number(rotate) + toRota;
			} else {
				clickTime = 0;
				rotate = Number(rotate) - toRota;
			}
			animItem.css("-webkit-transform","scale(1.4,1.4) rotate("+rotate+"deg)");
			animItem.css("-moz-transform","scale(1.4,1.4) rotate("+rotate+"deg)");
			animItem.css("transform","scale(1.4,1.4) rotate("+rotate+"deg)");
		} else {
			animItem.css("-webkit-transform","scale(1.5,1.5)");
			animItem.css("-moz-transform","scale(1.5,1.5)");
			animItem.css("transform","scale(1.5,1.5)");
		}
		//不可快速连续点击
		animItem.attr("disabled","disabled"); 

		setTimeout(function(){
			if(randomAnim!=0){
				if(clickTime==0){
					// clickTime = 1;
					rotate = Number(rotate) + toRota;
				} else {
					rotate = Number(rotate) - toRota;
				}
			}
			animItem.removeAttr("style");
			animItem.removeAttr("disabled");
			// animItem.removeClass("-webkit-transform");
			// animItem.removeClass("-moz-transform");
			// animItem.removeClass("transform");
			// animItem.css("-webkit-transform","scale(1,1) rotate("+rotate+"deg)");
			// animItem.css("-moz-transform","scale(1,1) rotate("+rotate+"deg)");
			// animItem.css("transform","scale(1,1) rotate("+rotate+"deg)");
		},200),

		console.log(event);
		// console.log('click');
		//调用jQuery脚本请求
		// jQuery.getScript('http://api.hitokoto.us/rand?uid=3153',function(data,err){  
		// 		console.log("ajax 一言");
		// 		console.log(err);
		// 	});
		// });
		$.ajax({
		  url: 'http://api.hitokoto.us/rand?uid=3153&encode=jsc&fun=async',
		  dataType: "jsonp"
		});
	});

});