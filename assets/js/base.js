
// function getByClass(oParent, sClass) {
//         var aEle=oParent.getElementsByTagName('*');
//         var aResult=[];
//         var re=new RegExp('\\b'+sClass+'\\b', 'i');
//         for(var i=0;i<aEle.length;i++) {
//                 if(re.test(aEle[i].className)) {
//                         aResult.push(aEle[i]);
//                 }
//         }
//         return aResult;
// }
// function getWinWidth() {
// 	if (window.innerWidth)
// 		winWidth = window.innerWidth;
// 	else if ((document.body) && (document.body.clientWidth))
// 		winWidth = document.body.clientWidth;
// 	if (document.documentElement && document.documentElement.clientHeight && document.documentElement.clientWidth) {
// 		winWidth = document.documentElement.clientWidth;
// 	}
// 	return winWidth;
// }
// function getWinHeight() {
// 	if (window.innerHeight)
// 		winHeight = window.innerHeight;
// 	else if ((document.body) && (document.body.clientHeight))
// 		winHeight = document.body.clientHeight;
// 	if (document.documentElement && document.documentElement.clientHeight) {
// 		winHeight = document.documentElement.clientHeight;
// 	}
// 	return winHeight;
// }

// var loading;
// var container;
// var full_img;
// var header;
// var overlay;
// var about;
// var index_nav;

// function initView(){
// 	loading = document.getElementById("loading");
// 	container = document.getElementById("container");
// 	full_img = getByClass(document, "full-width");
// 	header = document.getElementById("header");
// 	overlay = document.getElementById("overlay");
// 	about = document.getElementById("about");
// 	index_nav = document.getElementById("index_nav");
// }

// function loadOK(){
// 	if(loading)
// 		loading.style.opacity = 0;
// 	if(container)
// 		container.style.opacity = 1;
// }



// var index_nav = document.getElementById("index_nav");
// function setOpacity(){
// 	var top = document.documentElement.scrollTop || document.body.scrollTop;
// 	if(header) {
// 		header.style.backgroundPosition="50%"+ top/5 + "px";
// 	}
// 	if(about){
// 		about.style.opacity = 1-top/1000*3.5;
// 	}
// 	if(overlay){
// 		//overlay.style.opacity = 0.5 + top/1000;
// 		overlay.style.opacity = 0 + top/1000;
// 	}
// 	if(index_nav ){
// 		index_nav.style.opacity = top>200? 0 + 1:0;
// 	}
// }

// var resize = function(){
// 	var winWidth = getWinWidth();
// 	var winHeight = getWinHeight();
// 	if(full_img){
// 		for(var i = 0; i < full_img.length; i++){
// 			full_img[i].style.width = winWidth+"px";
// 		}
// 	}
// 	console.log(winWidth+" "+winHeight)
// 	if(index_nav){
// 		if(winWidth<600){
// 			index_nav.style.left = 'auto';
// 			index_nav.style.right = '0px';
// 		}
// 		//index_nav.style.top = winHeight - 50px;
// 	}

// }

// resize();
// window.onresize = resize;

// window.onscroll = function () { 
// 	setOpacity();
// };
// setOpacity();
