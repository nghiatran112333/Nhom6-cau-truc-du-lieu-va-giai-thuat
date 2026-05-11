import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GRID_SIZE, CELL_SIZE, TERRAIN_TYPES } from './constants.js';
import { sleep } from './utils.js';
import { playSound, playMagicSweep } from './audio.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.composer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.clock = new THREE.Clock();
        
        this.grid = [];
        this.character = null;
        this.knight = null;
        this.pathLine = null;
        this.particles = [];
        this.embers = [];
    }

    init(container) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020617); 
        this.scene.fog = new THREE.Fog(0x020617, 20, 80);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(10, 10, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.maxPolarAngle = Math.PI / 2.1;

        const ambientLight = new THREE.AmbientLight(0x4c1d95, 0.6);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xef4444, 1.5);
        sunLight.position.set(10, 30, 15);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        this.scene.add(sunLight);

        const rimLight = new THREE.PointLight(0x9333ea, 1, 50);
        rimLight.position.set(-10, 10, -10);
        this.scene.add(rimLight);

        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.1;
        bloomPass.strength = 1.0;
        
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);

        this.createGrid();
        this.createWizard();
        this.createKnight();
        this.createEmbers();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    createGrid() {
        const offset = (GRID_SIZE * CELL_SIZE) / 2;
        for (let r = 0; r < GRID_SIZE; r++) {
            this.grid[r] = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                const type = 'grass';
                const info = TERRAIN_TYPES[type];
                const geometry = new THREE.BoxGeometry(CELL_SIZE - 0.05, 0.15, CELL_SIZE - 0.05);
                const material = new THREE.MeshStandardMaterial({ 
                    color: info.color,
                    transparent: !!info.opacity,
                    opacity: info.opacity || 1,
                    metalness: info.metalness,
                    roughness: info.roughness
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(r * CELL_SIZE - offset + CELL_SIZE/2, 0, c * CELL_SIZE - offset + CELL_SIZE/2);
                mesh.receiveShadow = true;
                mesh.castShadow = true;
                mesh.userData = { r, c };
                this.scene.add(mesh);

                this.grid[r][c] = {
                    r, c, type, mesh,
                    isVisited: false, parent: null,
                    g: Infinity, f: Infinity,
                    decorations: []
                };
            }
        }
    }

    createWizard() {
        const wizardGroup = new THREE.Group();
        const bodyGeo = new THREE.CylinderGeometry(0, 0.35, 0.8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.4;
        body.castShadow = true;
        wizardGroup.add(body);

        const beardGeo = new THREE.ConeGeometry(0.12, 0.3, 8);
        const beardMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const beard = new THREE.Mesh(beardGeo, beardMat);
        beard.position.set(0, 0.65, 0.1);
        wizardGroup.add(beard);

        const headGeo = new THREE.SphereGeometry(0.15, 12, 12);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.8;
        wizardGroup.add(head);

        const hatBaseGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12);
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x020617 });
        const hatBase = new THREE.Mesh(hatBaseGeo, hatMat);
        hatBase.position.y = 0.92;
        wizardGroup.add(hatBase);

        const hatTopGeo = new THREE.ConeGeometry(0.18, 0.6, 12);
        const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
        hatTop.position.set(0, 1.2, -0.1);
        hatTop.rotation.x = -0.3;
        wizardGroup.add(hatTop);

        const staffGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6);
        const staffMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        const staff = new THREE.Mesh(staffGeo, staffMat);
        staff.position.set(0.3, 0.7, 0);
        staff.rotation.z = -0.1;
        wizardGroup.add(staff);

        const gemGeo = new THREE.IcosahedronGeometry(0.1, 0);
        const gemMat = new THREE.MeshStandardMaterial({ 
            color: 0x4ade80, emissive: 0x4ade80, emissiveIntensity: 10 
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(0.35, 1.4, 0);
        wizardGroup.add(gem);

        const gemLight = new THREE.PointLight(0x4ade80, 3, 5);
        gemLight.position.copy(gem.position);
        wizardGroup.add(gemLight);

        this.character = wizardGroup;
        this.scene.add(this.character);
        this.character.scale.setScalar(1.5);
    }

    updateWizardPos(endNode) {
        const offset = (GRID_SIZE * CELL_SIZE) / 2;
        this.character.position.set(endNode.r * CELL_SIZE - offset + CELL_SIZE/2, 0, endNode.c * CELL_SIZE - offset + CELL_SIZE/2);
    }

    createKnight() {
        const knightGroup = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.45, 0.6, 0.35);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.8, roughness: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.4;
        body.castShadow = true;
        knightGroup.add(body);

        const helmGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const helmMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9 });
        const helm = new THREE.Mesh(helmGeo, helmMat);
        helm.position.y = 0.8;
        knightGroup.add(helm);

        const eyeGeo = new THREE.SphereGeometry(0.03, 4, 4);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 10 });
        
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.08, 0.85, 0.15);
        knightGroup.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.08, 0.85, 0.15);
        knightGroup.add(eyeR);

        const shieldGeo = new THREE.BoxGeometry(0.4, 0.5, 0.05);
        const shieldMat = new THREE.MeshStandardMaterial({ color: 0x450a0a });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.position.set(0.3, 0.4, 0.1);
        shield.rotation.y = -0.5;
        knightGroup.add(shield);

        const ringGeo = new THREE.TorusGeometry(0.6, 0.03, 16, 32);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 5, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.05;
        knightGroup.add(ring);

        this.knight = knightGroup;
        this.scene.add(this.knight);
        this.knight.scale.setScalar(1.5);
    }

    updateCharacterPos(r, c) {
        const offset = (GRID_SIZE * CELL_SIZE) / 2;
        this.knight.position.set(r * CELL_SIZE - offset + CELL_SIZE/2, 0, c * CELL_SIZE - offset + CELL_SIZE/2);
        this.spawnMagicParticles(this.knight.position.x, 0.5, this.knight.position.z, 0xef4444, 4);
    }

    spawnMagicParticles(x, y, z, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const mat = new THREE.MeshStandardMaterial({ 
                color: color, emissive: color, emissiveIntensity: 5, transparent: true
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.set(x, y, z);
            
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.15,
                (Math.random() - 0.5) * 0.1
            );
            
            this.particles.push({ mesh: p, velocity: vel, life: 1.0 });
            this.scene.add(p);
        }
    }

    createEmbers() {
        for(let i=0; i<30; i++) {
            const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0xff4500, emissive: 0xff4500, emissiveIntensity: 10, transparent: true, opacity: 0.6
            });
            const ember = new THREE.Mesh(geo, mat);
            this.resetEmber(ember);
            this.scene.add(ember);
            this.embers.push(ember);
        }
    }

    resetEmber(ember) {
        const range = 15;
        ember.position.set((Math.random() - 0.5) * range, Math.random() * 5 + 2, (Math.random() - 0.5) * range);
        ember.userData.speed = Math.random() * 0.02 + 0.01;
    }

    updateCell(r, c, type) {
        const node = this.grid[r][c];
        const info = TERRAIN_TYPES[type];
        
        node.decorations.forEach(d => this.scene.remove(d));
        node.decorations = [];

        node.type = type;
        node.mesh.material.color.set(info.color);
        node.mesh.material.opacity = info.opacity || 1;
        node.mesh.material.transparent = !!info.opacity;
        node.mesh.material.emissive.set(info.emissive || 0x000000);

        if (info.hasTrees) {
            const treeCount = 1 + Math.floor(Math.random() * 2);
            for(let i=0; i<treeCount; i++) {
                const treeGroup = new THREE.Group();
                const trunkGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.6);
                const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 0.3;
                treeGroup.add(trunk);

                const leaveGeo = new THREE.ConeGeometry(0.25, 0.5, 8);
                const leaveMat = new THREE.MeshStandardMaterial({ color: 0x059669 });
                const leaves = new THREE.Mesh(leaveGeo, leaveMat);
                leaves.position.y = 0.6;
                treeGroup.add(leaves);

                treeGroup.position.set(
                    node.mesh.position.x + (Math.random() - 0.5) * 0.4, 
                    0, 
                    node.mesh.position.z + (Math.random() - 0.5) * 0.4
                );
                this.scene.add(treeGroup);
                node.decorations.push(treeGroup);
            }
        }
        
        if (type === 'grass') {
            const flowerCount = 2 + Math.floor(Math.random() * 2);
            for(let i=0; i<flowerCount; i++) {
                const flowerGeo = new THREE.SphereGeometry(0.05, 8, 8);
                const flowerMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0x9333ea, emissiveIntensity: 2 });
                const flower = new THREE.Mesh(flowerGeo, flowerMat);
                flower.position.set(node.mesh.position.x + (Math.random() - 0.5) * 0.7, 0.05, node.mesh.position.z + (Math.random() - 0.5) * 0.7);
                this.scene.add(flower);
                node.decorations.push(flower);
                flower.userData.isFlower = true;
                flower.userData.offset = Math.random() * 5;
            }
        }

        if (info.hasRocks) {
            const rockCount = 3 + Math.floor(Math.random() * 2);
            for(let i=0; i<rockCount; i++) {
                const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.2, 0);
                const rockMat = new THREE.MeshStandardMaterial({ color: 0x020617, emissive: 0xef4444, emissiveIntensity: 2, metalness: 0.9, roughness: 0.1 });
                const rock = new THREE.Mesh(rockGeo, rockMat);
                rock.position.set(node.mesh.position.x + (Math.random() - 0.5) * 0.6, 0.15, node.mesh.position.z + (Math.random() - 0.5) * 0.6);
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                this.scene.add(rock);
                node.decorations.push(rock);
                rock.userData.isCrystal = true;
                rock.userData.offset = Math.random() * Math.PI;
            }
            
            const runeGeo = new THREE.PlaneGeometry(0.4, 0.4);
            const runeMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
            const rune = new THREE.Mesh(runeGeo, runeMat);
            rune.position.set(node.mesh.position.x, 0.8, node.mesh.position.z);
            rune.rotation.x = Math.PI / 2;
            this.scene.add(rune);
            node.decorations.push(rune);
            rune.userData.isRune = true;

            const emberLight = new THREE.PointLight(0xef4444, 2, 3);
            emberLight.position.set(node.mesh.position.x, 0.5, node.mesh.position.z);
            this.scene.add(emberLight);
            node.decorations.push(emberLight);
        }
    }

    clearVisuals(startNode, endNode) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const node = this.grid[r][c];
                if (!node) continue;
                node.isVisited = false;
                node.parent = null;
                node.g = Infinity;
                node.f = Infinity;
                
                const baseColor = TERRAIN_TYPES[node.type].color;
                const baseEmissive = TERRAIN_TYPES[node.type].emissive;
                node.mesh.material.color.set(baseColor);
                node.mesh.material.emissive.set(baseEmissive || 0x000000);
                node.mesh.material.emissiveIntensity = 1;
                node.mesh.material.opacity = TERRAIN_TYPES[node.type].opacity || 1;
            }
        }
        
        if (this.character) this.character.visible = true; 
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
            this.pathLine = null;
        }
        this.updateCharacterPos(startNode.r, startNode.c);
    }

    draw3DPath(path) {
        if (path.length < 2) return;
        const points = path.map(node => {
            const offset = (GRID_SIZE * CELL_SIZE) / 2;
            return new THREE.Vector3(node.r * CELL_SIZE - offset + CELL_SIZE/2, 0.4, node.c * CELL_SIZE - offset + CELL_SIZE/2);
        });

        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
        const tubeGeo = new THREE.TubeGeometry(curve, path.length * 12, 0.1, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xff4500, emissiveIntensity: 5, transparent: true, opacity: 0.8 });
        this.pathLine = new THREE.Mesh(tubeGeo, tubeMat);
        this.scene.add(this.pathLine);
    }

    async animateCharacter(path, state) {
        for (let i = 0; i < path.length; i++) {
            if (state.currentSearchId !== state.activeSearchId) return;
            const node = path[i];
            const offset = (GRID_SIZE * CELL_SIZE) / 2;
            const targetPos = new THREE.Vector3(node.r * CELL_SIZE - offset + CELL_SIZE/2, 0, node.c * CELL_SIZE - offset + CELL_SIZE/2);
            
            const startPos = this.knight.position.clone();
            const duration = 20;
            for (let t = 0; t <= duration; t++) {
                this.knight.position.lerpVectors(startPos, targetPos, t / duration);
                this.knight.position.y = Math.abs(Math.sin((t / duration) * Math.PI)) * 0.4;
                if (t % 5 === 0) this.spawnMagicParticles(this.knight.position.x, 0.2, this.knight.position.z, 0xef4444, 2);
                await sleep(10);
            }
            playSound(220 + i * 10, 'triangle', 0.05, 0.05);
        }
    }

    async knightAttackAnimation() {
        const originalPos = this.knight.position.clone();
        const targetPos = this.character.position.clone();
        
        for(let i=0; i<10; i++) {
            this.knight.position.lerpVectors(originalPos, targetPos, i/10);
            await sleep(20);
        }
        playMagicSweep(110, 880, 0.5);
        this.spawnMagicParticles(targetPos.x, 1, targetPos.z, 0x4ade80, 20);
        this.character.visible = false;
        
        for(let i=0; i<10; i++) {
            this.knight.position.lerpVectors(targetPos, originalPos, i/10);
            await sleep(20);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        if (this.controls) this.controls.update();

        this.particles = this.particles.filter(p => {
            p.mesh.position.add(p.velocity);
            p.life -= 0.02;
            p.mesh.material.opacity = p.life;
            p.mesh.scale.setScalar(p.life);
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                return false;
            }
            return true;
        });

        this.embers.forEach(ember => {
            ember.position.y += ember.userData.speed;
            ember.position.x += Math.sin(time + ember.position.y) * 0.01;
            if (ember.position.y > 8) this.resetEmber(ember);
        });

        this.grid.flat().forEach(node => {
            node.decorations.forEach(d => {
                if (d.userData.isCrystal) d.rotation.y += 0.02;
                if (d.userData.isRune) d.position.y = 0.8 + Math.sin(time * 2 + d.userData.offset) * 0.1;
                if (d.userData.isFlower) d.scale.setScalar(1 + Math.sin(time * 3 + d.userData.offset) * 0.1);
            });
        });

        if (this.composer) this.composer.render();
    }
}
