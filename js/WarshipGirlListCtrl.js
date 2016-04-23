angular.module('warshipgirls', []).controller('WarshipGirlListCtrl', ["$http", "$scope", function ($http, $scope) {
	var ctrl = this;
	var skeletonNamePrefix = "Ship_girl_";
	var scene, camera, renderer;
	var geometry, material, mesh;
	var anim;

	ctrl.data = {};
	ctrl.meta = {};

	ctrl.getShipTitle = function(data) {
		var shipId = "";
		if (data.shipIndex != undefined) {
			shipId = "" + data.shipIndex;
		} else if (data.picId != undefined) {
			shipId = "" + data.picId;
		} else {
			shipId = "???";
		}
		var title = shipId + ' - ' + data.title;
		if (parseInt(data.evoClass) == 1) {
			title = title + "(改)";
		}
		return title;
	};

	ctrl.initData = function(){
		$http({
      method: "GET",
      url: "data/warshipgirls.json"
    }).success(function(data){
    	ctrl.meta.warshipgirls = data;
    	ctrl.data.shipCard = ctrl.meta.warshipgirls.shipCard[0];
    	ctrl.data.animations = [];
    	ctrl.data.skins = [];
    	ctrl.selectShip();
    });
	};

	ctrl.selectShip = function() {
		ctrl.load(skeletonNamePrefix + ctrl.data.shipCard.picId, 1);
	};


	ctrl.init = function() {
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);

		camera.position.y = 150;
		camera.position.z = 400;

		geometry = new THREE.BoxGeometry(0, 0, 0);
		material = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });

		mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		renderer = new THREE.WebGLRenderer();
		renderer.setSize(window.innerWidth, window.innerHeight - document.getElementById("control-div").clientHeight);
		renderer.setClearColor( 0x000000, 0);
		document.body.appendChild(renderer.domElement);

		ctrl.render();

	}

	ctrl.animate = function() {
		requestAnimationFrame(ctrl.animate);

		var t = Date.now();
		var a = Math.sin(t * 6e-4);
		var b = Math.cos(t * 3e-4);

		// mesh.rotation.x = a * Math.PI * 0.2;
		// mesh.rotation.y = b * Math.PI * 0.4;

		if (anim != undefined) {
			anim.update();
		}

		renderer.render(scene, camera);
	}

	ctrl.selectSkin = function() {
		if (anim != undefined) {
			anim.skeleton.setSkinByName(ctrl.data.selectedSkin.name);
			anim.skeleton.setSlotsToSetupPose();
		}
	};

	ctrl.selectAnimation = function() {
		if (anim != undefined) {
			anim.state.setAnimationByName(0, ctrl.data.selectedAnimation.name, true);

		}
	};

	ctrl.load = function(name, scale) {
		if (anim) anim.dispose();

		anim = new SpineAnimation(name, 'data/animations', scale);

		anim.addEventListener(SpineAnimation.SKELETON_DATA_LOADED, function () {
			ctrl.data.skins = [];
			ctrl.data.animations = [];

			if (anim.skeleton.data.skins.length > 1) {
				_.each(anim.skeleton.data.skins, function(skin){
					if (skin.name != "default") {
						ctrl.data.skins.push(skin);
					}
				});

			} else {
				_.each(anim.skeleton.data.skins, function(skin){
					ctrl.data.skins.push(skin);
				});
			}
			_.each(anim.skeleton.data.animations, function(anim){
				if (anim.name != "Antiaircraft") {
					ctrl.data.animations.push(anim);
				}
			});

			$scope.$apply(function(){
				ctrl.data.selectedAnimation = ctrl.data.animations[0];
				ctrl.data.selectedSkin = ctrl.data.skins[0];
			});

			var canvas = renderer.domElement;

			anim.skeleton.setSkinByName(ctrl.data.selectedSkin.name); // TODO - spine.Skeleton.prototype.setSkin doesn't work?
			anim.skeleton.setSlotsToSetupPose();
			anim.state.setAnimationByName(0, ctrl.data.selectedAnimation.name, true);
		});

		mesh.add(anim);
	}

	ctrl.render = function() {
		requestAnimationFrame( ctrl.render );
		renderer.setSize(window.innerWidth, window.innerHeight - document.getElementById("control-div").clientHeight);
		renderer.render( scene, camera );
	}

	ctrl.initData();
	ctrl.init();
	ctrl.animate();


}]);