'use strict';
/**
 * Hunters — GLTF city (LittlestTokyo) + skinned Soldier (skinning/blending example), offline ./models/ with CDN fallback.
 */
(function (global) {
    const GL = {
        soldier: null,
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
                if (!global.GLTFLoader) {
                    console.warn('HuntersGL: GLTFLoader not found');
                    return resolve();
                }

                const loader = new global.GLTFLoader();

                // Setup DRACOLoader if available
                if (global.DRACOLoader) {
                    try {
                        const dracoLoader = new global.DRACOLoader();
                        // Use official Draco decoders from CDN
                        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                        loader.setDRACOLoader(dracoLoader);
                    } catch (e) {
                        console.warn('HuntersGL: DRACOLoader init failed', e);
                    }
                }

                let pending = 2;
                function done() {
                    pending--;
                    if (pending <= 0) resolve();
                }

                const soldierUrls = [
                    'https://threejs.org/examples/models/gltf/Soldier.glb',
                    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb',
                    './models/Soldier.glb'
                ];

                const cityUrls = [
                    'https://threejs.org/examples/models/gltf/LittlestTokyo.glb',
                    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/LittlestTokyo.glb',
                    './models/LittlestTokyo.glb'
                ];

                const loadModel = (urls, name, onOk) => {
                    let idx = 0;
                    const tryLoad = () => {
                        if (idx >= urls.length) {
                            console.warn('HuntersGL: Failed to load ' + name);
                            done();
                            return;
                        }
                        loader.load(urls[idx], (gltf) => {
                            onOk(gltf);
                            done();
                        }, undefined, () => {
                            idx++;
                            tryLoad();
                        });
                    };
                    tryLoad();
                };

                // Load Soldier
                loadModel(soldierUrls, 'Soldier', (gltf) => {
                    self.soldier = gltf;
                    self.clips = gltf.animations || [];
                    console.log('HuntersGL: Soldier loaded');
                });

                // Load City
                loadModel(cityUrls, 'City', (gltf) => {
                    self.city = gltf;
                    console.log('HuntersGL: City loaded');
                });
            });
            return this.preloadPromise;
        },

        removeCity(scene) {
            if (this.cityRoot) {
                scene.remove(this.cityRoot);
                this.cityRoot = null;
            }
        },

        applyCityForMap(mdef, scene, mapCityMeshes, floorMesh) {
            this.removeCity(scene);
            if (floorMesh) floorMesh.visible = true;
            if (!mdef || !mdef.urbanGltf || !this.city) return;

            const root = this.city.scene.clone(true);
            const b = mdef.bounds || 14;
            // LittlestTokyo is very large, needs aggressive scaling down
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
            scene.add(root);
            this.cityRoot = root;
            if (floorMesh) floorMesh.visible = false;
        },

        pickClip(keywords) {
            const low = keywords.map(k => k.toLowerCase());
            for (let i = 0; i < this.clips.length; i++) {
                const a = this.clips[i];
                const n = (a.name || '').toLowerCase();
                for (let j = 0; j < low.length; j++) {
                    if (n.includes(low[j])) return a;
                }
            }
            return this.clips[0] || null;
        },

        /**
         * Clones the Soldier model and sets up the blending mixer.
         * Based on webgl_animation_skinning_blending.
         */
        cloneSoldier(colorHex) {
            const THREE = global.THREE;
            const SU = global.SkeletonUtils;
            if (!this.soldier || !SU) return null;

            const clone = SU.clone(this.soldier.scene);
            clone.scale.setScalar(2.0); // Adjust scale to match hunters world
            
            // Tint if needed
            if (colorHex !== undefined) {
                const tint = new THREE.Color(colorHex);
                clone.traverse(function (o) {
                    if (o.isMesh) {
                        const mats = Array.isArray(o.material) ? o.material : [o.material];
                        for (let i = 0; i < mats.length; i++) {
                            const m = mats[i];
                            if (m && m.color) m.color = m.color.clone().lerp(tint, 0.15);
                        }
                    }
                });
            }

            const mixer = new THREE.AnimationMixer(clone);
            const clips = this.soldier.animations;
            
            // Expected Soldier clips: 0:Idle, 1:Walk, 2:Run
            const actions = {
                idle: mixer.clipAction(clips[0] || this.pickClip(['idle'])),
                walk: mixer.clipAction(clips[1] || this.pickClip(['walk'])),
                run: mixer.clipAction(clips[2] || this.pickClip(['run']))
            };

            // Setup blending weights
            Object.values(actions).forEach(a => {
                if (a) {
                    a.play();
                    a.enabled = true;
                    a.setEffectiveTimeScale(1.0);
                    a.setEffectiveWeight(0);
                }
            });
            if (actions.idle) actions.idle.setEffectiveWeight(1.0);

            return { root: clone, mixer: mixer, actions: actions };
        },

        // Helper to update weights based on speed (0 to 1)
        updateBlending(charObj, speedRatio) {
            const actions = charObj.actions;
            if (!actions) return;

            // Simplified blending logic from example
            const idle = actions.idle;
            const walk = actions.walk;
            const run = actions.run;

            if (!idle || !walk || !run) return;

            let idleW = 0, walkW = 0, runW = 0;
            if (speedRatio < 0.1) {
                idleW = 1;
            } else if (speedRatio < 0.5) {
                const alpha = (speedRatio - 0.1) / 0.4;
                idleW = 1 - alpha;
                walkW = alpha;
            } else {
                const alpha = (speedRatio - 0.5) / 0.5;
                walkW = 1 - alpha;
                runW = alpha;
            }

            idle.setEffectiveWeight(idleW);
            walk.setEffectiveWeight(walkW);
            run.setEffectiveWeight(runW);
        }
    };

    global.HuntersGL = GL;
})(typeof window !== 'undefined' ? window : this);
