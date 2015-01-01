

$(document).ready(function() {
	$('.scroll-to-top').click(function (b) {
		b.preventDefault();
		$("body, html").animate({
			scrollTop:0},1600);
		return false;
	});
});