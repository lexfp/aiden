'use strict';
/**
 * Hunters — GLTF city (LittlestTokyo) + skinned bots (Xbot), offline ./models/ with CDN fallback.
 * Same asset workflow as three.js examples (skinning / keyframes).
 */
(function (global) {
    const GL = {
        xbot: null,
        city: null,
        cityRoot: null,
        clips: [],
        _pmrem: false,
        preloadPromise: null,

        initEnvironment(scene, renderer) {
            if (this._pmrem || !global.THREE || !global.RoomEnvironment || !global.THREE.PMREMGenerator) return;
            try {
                const THREE = global.THREE;
                const pmrem = new THREE.PMREMGenerator(renderer);
                const env = new global.RoomEnvironment();
                scene.environment = pmrem.fromScene(env, 0.04).texture;
                env.dispose();
                pmrem.dispose();
                this._pmrem = true;
            } catch (e) {
                console.warn('HuntersGL.initEnvironment', e);
            }
        },

        loadGltf(urls, onLoad, onError) {
            if (typeof global.GLTFLoader === 'undefined') {
                if (onError) onError();
                return;
            }
            const loader = new global.GLTFLoader();
            let i = 0;
            function tryNext() {
                if (i >= urls.length) {
                    if (onError) onError();
                    return;
                }
                loader.load(urls[i], onLoad, undefined, function () {
                    i++;
                    tryNext();
                });
            }
            tryNext();
        },

        preload() {
            if (this.preloadPromise) return this.preloadPromise;
            const THREE = global.THREE;
            const self = this;
            this.preloadPromise = new Promise(function (resolve) {
                let pending = 2;
                function done() {
                    pending--;
                    if (pending <= 0) resolve();
                }

                self.loadGltf(
                    ['./models/Xbot.glb', 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Xbot.glb'],
                    function (gltf) {
                        self.xbot = gltf;
                        self.clips = gltf.animations || [];
                        gltf.scene.traverse(function (o) {
                            if (o.isMesh) {
                                o.castShadow = true;
                                o.receiveShadow = true;
                                const mats = Array.isArray(o.material) ? o.material : [o.material];
                                for (let j = 0; j < mats.length; j++) {
                                    const m = mats[j];
                                    if (m && m.map && m.map.colorSpace !== undefined) m.map.colorSpace = THREE.SRGBColorSpace;
                                }
                            }
                        });
                        done();
                    },
                    function () {
                        console.warn('HuntersGL: Xbot preload failed');
                        done();
                    }
                );

                self.loadGltf(
                    ['./models/LittlestTokyo.glb', 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/LittlestTokyo.glb'],
                    function (gltf) {
                        self.city = gltf;
                        done();
                    },
                    function () {
                        console.warn('HuntersGL: LittlestTokyo preload failed');
                        done();
                    }
                );
            });
            return this.preloadPromise;
        },

        removeCity(scene) {
            if (this.cityRoot) {
                scene.remove(this.cityRoot);
                this.cityRoot = null;
            }
        },

        /**
         * @param {object} mdef — map definition; uses urbanGltf + bounds
         * @param {THREE.Scene} scene
         * @param {THREE.Mesh[]} mapCityMeshes — meshes appended for raycasts
         * @param {THREE.Mesh} [floorMesh] — hidden when city visible
         */
        applyCityForMap(mdef, scene, mapCityMeshes, floorMesh) {
            this.removeCity(scene);
            if (floorMesh) floorMesh.visible = true;
            if (!mdef || !mdef.urbanGltf || !this.city) return;

            const THREE = global.THREE;
            const root = this.city.scene.clone(true);
            const b = mdef.bounds || 14;
            const scale = 0.012 * (b / 14);
            root.scale.setScalar(scale);
            root.position.set(0, 0, 0);
            root.traverse(function (o) {
                o.userData.isMap = true;
                o.userData.isCityGltf = true;
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    for (let i = 0; i < mats.length; i++) {
                        const m = mats[i];
                        if (m && m.map && m.map.colorSpace !== undefined) m.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    mapCityMeshes.push(o);
                }
            });
            root.name = 'LittlestTokyo';
            scene.add(root);
            this.cityRoot = root;
            if (floorMesh) floorMesh.visible = false;
        },

        pickClip(keywords) {
            const low = keywords.map(function (k) {
                return k.toLowerCase();
            });
            for (let i = 0; i < this.clips.length; i++) {
                const a = this.clips[i];
                const n = (a.name || '').toLowerCase();
                for (let j = 0; j < low.length; j++) {
                    if (n.includes(low[j])) return a;
                }
            }
            return this.clips[0] || null;
        },

        cloneXbotBot(colorHex) {
            const THREE = global.THREE;
            const SU = global.SkeletonUtils;
            if (!this.xbot || !SU) return null;
            const clone = SU.clone(this.xbot.scene);
            clone.scale.setScalar(0.02);
            const tint = new THREE.Color(colorHex);
            clone.traverse(function (o) {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    for (let i = 0; i < mats.length; i++) {
                        const m = mats[i];
                        if (m && m.color) m.color = m.color.clone().lerp(tint, 0.22);
                    }
                }
            });
            const mixer = new THREE.AnimationMixer(clone);
            const idleClip = this.pickClip(['idle', 'neutral']) || this.clips[0];
            const runClip = this.pickClip(['run', 'jog', 'walk', 'sprint']) || idleClip;
            let idleAction = null;
            let runAction = null;
            if (idleClip) {
                idleAction = mixer.clipAction(idleClip);
                idleAction.play();
            }
            if (runClip) {
                runAction = mixer.clipAction(runClip);
                runAction.play();
                runAction.weight = 0;
            }
            return { root: clone, mixer: mixer, idleAction: idleAction, runAction: runAction };
        },
    };

    global.HuntersGL = GL;
})(typeof window !== 'undefined' ? window : this);
