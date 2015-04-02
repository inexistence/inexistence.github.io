$(window).load(
function(){
	// setTimeout(function(){
	// 	$("#posts").css("opacity","1");
	// 	$("#loading").css("opacity","0");
	// },450);
 //    setTimeout(function(){
 //    	$("#pagination").css("opacity","1");
 //    	$("a#install-button").css("top","3px");
 //      },600);
  }
);

$(document).ready(function() {

	$("a#slide").click(
	function(){
		$("body").toggleClass("slide");
		// $("body").css("overflow-y","hidden");
		$("html").css("overflow","hidden");
	});

	$("#fade").click(
	function(){
		$("body").removeClass("slide");
		// $("body").css("overflow-y","auto");
		$("html").css("overflow","auto");
	});
	// $("a.share-button").click(
	// 	function(){
	// 		var id = $(this).attr('rel');$('.share' + id).fadeToggle("")
	// 	});
 //      $(".entry").mouseleave(
 //      	function(){
 //      		$(".share").fadeOut("")
 //      	});

});
// $("a#switch").click(
// function(){
// 	$(".entry").css("opacity","0");
// 	$("a#switch").toggleClass("switch");
// 	setTimeout(function(){
// 		$("body").toggleClass("switch");
// 		// $('.photoset-grid').photosetGrid();
// 	},500);
// 	setTimeout(function(){
// 		$("body #posts").masonry();
// 		$("html,body").animate({
// 			scrollTop:$(".top").offset().top
// 		},"slow")
// 	},900);
// 	setTimeout(function(){
// 		$(".entry").css("opacity","1")
// 	},1300);
// });