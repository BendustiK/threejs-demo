var loadText = function (url, callback) {
	var req = new XMLHttpRequest();
	req.open("GET", url, true);
	req.responseType = 'text';
	req.addEventListener('error', function (event) {}, false);
	req.addEventListener('abort', function (event) {}, false);
	req.addEventListener('load', function (event) { callback(req.response); }, false);
	req.send();
	return req;
};

var loadImage = function (url, callback) {
	var image = new Image();
	image.addEventListener('error', function (event) {}, false);
	image.addEventListener('abort', function (event) {}, false);
	image.addEventListener('load', function (event) { callback (image); }, false);
	image.src = url;
	return image;
};

SpineAnimation = function (name, path, scale) {

	THREE.Object3D.call(this);

	this.name = name;

	path = path ? (path +
		((path.substr(-1) != '/') ? '/' : '')
	) : '';

	var self = this;

	loadText(path + name + '.atlas', function (atlasText) {
		self.atlas = new spine.Atlas(atlasText, {
			load: function (page, image, atlas) {
				loadImage(path + image, function (image) {
					// calculate UVs in atlas regions
					page.width = image.width;
					page.height = image.height;

					atlas.updateUVs(page);

					// propagate new UVs to attachments, if they were already created
					if (self.skeleton) {
						var skins = self.skeleton.data.skins;
						for (var s = 0, n = skins.length; s < n; s++) {
							var attachments = skins[s].attachments;
							for (var k in attachments) {
								var attachment = attachments[k];
								if (attachment instanceof spine.RegionAttachment) {
									var region = attachment.rendererObject;
									attachment.setUVs(region.u, region.v, region.u2, region.v2, region.rotate);
								}
							}
						}
					}

					// create basic material for the page
					var texture = new THREE.Texture(image);
					texture.needsUpdate = true;

					page.rendererObject = [
						new THREE.MeshBasicMaterial({
							//color: 0xff00, wireframe: true,
							map : texture, side : THREE.DoubleSide, transparent : true, alphaTest : 0.5
						})
					];
				});
			},
			unload: function (materials) {
				for (var i = 0, n = materials.length; i < n; i++) {
					var material = materials[i];
					if (material.meshes) {
						for (var name in material.meshes) {
							var mesh = material.meshes[name];
							if (mesh.parent) mesh.parent.remove(mesh);
							mesh.geometry.dispose();
						}
					}
					material.map.dispose();
					material.dispose();
				}
				// will be called multiple times
				materials.length = 0;
			}
		});

		loadText(path + name + '.json', function (skeletonText) {
			var json = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(self.atlas));
			json.scale = scale || 1;

			var skeletonData = json.readSkeletonData(JSON.parse(skeletonText));

			self.skeleton = new spine.Skeleton(skeletonData);
			self.stateData = new spine.AnimationStateData(skeletonData);	
			self.state = new spine.AnimationState(self.stateData);

			self.dispatchEvent({
				type : SpineAnimation.SKELETON_DATA_LOADED
			});
		});
	});

	var matrix = new THREE.Matrix4();

	// if given, dt must be in ms

	this.update = function (dt, dz) {
		if (!this.state) return;

		this.state.update(dt || (1.0 / 60));
		this.state.apply(this.skeleton);
		this.skeleton.updateWorldTransform();

		this.traverse(function (object) {
			if (object instanceof THREE.Mesh) {
				object.visible = false;
			}
		});

		var Z = 0;
		var drawOrder = this.skeleton.drawOrder;
		for (var i = 0, n = drawOrder.length; i < n; i++) {
			var slot = drawOrder[i];
			var attachment = slot.attachment;
			if (!(attachment instanceof spine.RegionAttachment)) continue;

			var materials = attachment.rendererObject.page.rendererObject;
			// texture was not loaded yet
			if (!materials) continue;

			if (slot.data.additiveBlending && (materials.length == 1)) {
				// create separate material for additive blending
				materials.push(new THREE.MeshBasicMaterial({
					map : materials[0].map,
					side : THREE.DoubleSide,
					transparent : true,
					blending : THREE.AdditiveBlending,
					depthWrite : false
				}));
			}

			var material = materials[ slot.data.additiveBlending ? 1 : 0 ];

			material.meshes = material.meshes || {};

			var mesh = material.meshes[slot.data.name];

			var geometry;

			if (mesh) {
				geometry = mesh.geometry;

				mesh.visible = true;
			} else {
				geometry = new THREE.PlaneGeometry(
					attachment.regionOriginalWidth,
					attachment.regionOriginalHeight
				);
				geometry.dynamic = true;

				mesh = new THREE.Mesh(geometry, material);
				mesh.matrixAutoUpdate = false;

				material.meshes[slot.data.name] = mesh;
				this.add(mesh);
			}

			if (mesh.attachmentTime && (slot.getAttachmentTime () > mesh.attachmentTime)) {
				// do nothing
			} else {
				// update UVs
				geometry.faceVertexUvs[0][0][0].set(attachment.uvs[6], 1- attachment.uvs[7]);
				geometry.faceVertexUvs[0][0][1].set(attachment.uvs[4], 1- attachment.uvs[5]);
				geometry.faceVertexUvs[0][0][2].set(attachment.uvs[0], 1- attachment.uvs[1]);
				geometry.faceVertexUvs[0][1][0].set(attachment.uvs[4], 1- attachment.uvs[5]);
				geometry.faceVertexUvs[0][1][1].set(attachment.uvs[2], 1- attachment.uvs[3]);
				geometry.faceVertexUvs[0][1][2].set(attachment.uvs[0], 1- attachment.uvs[1]);
				geometry.uvsNeedUpdate = true;

				geometry.vertices[1].set(attachment.offset[0], attachment.offset[1], 0);
				geometry.vertices[3].set(attachment.offset[2], attachment.offset[3], 0);
				geometry.vertices[2].set(attachment.offset[4], attachment.offset[5], 0);
				geometry.vertices[0].set(attachment.offset[6], attachment.offset[7], 0);
				geometry.verticesNeedUpdate = true;

				mesh.attachmentTime = slot.getAttachmentTime();
			}

			matrix.makeTranslation(
				this.skeleton.x + slot.bone.worldX,
				this.skeleton.y + slot.bone.worldY,
				(dz || 0.1) * Z++
			);

			matrix.elements[0] = slot.bone.m00; matrix.elements[4] = slot.bone.m01;
			matrix.elements[1] = slot.bone.m10; matrix.elements[5] = slot.bone.m11;

			mesh.matrix.copy(matrix);
		}

	};
};

SpineAnimation.SKELETON_DATA_LOADED = 'skeletonDataLoaded';

SpineAnimation.prototype = Object.create(THREE.Object3D.prototype);

SpineAnimation.prototype.dispose = function () {
	if (this.parent) this.parent.remove(this); this.atlas.dispose();
};