import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let camera, scene, renderer, mixer, sound, model;
const clock = new THREE.Clock();

// Parámetros iniciales
const params = {
    color: 0x00ffcc, // Cyan inicial
    metalness: 0.5,
    roughness: 0.2,
    lightIntensity: 2.0,
    ambientIntensity: 0.3
};

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 300);

    scene = new THREE.Scene();

    // --- 1. CARGA DEL ESCENARIO 360 ---
    new EXRLoader().load('ferndale_studio_12_4k.exr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;
        texture.dispose();
    });

    // --- 2. ILUMINACIÓN ---
    const dirLight = new THREE.DirectionalLight(0xffffff, params.lightIntensity);
    dirLight.position.set(0, 500, 100);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, params.ambientIntensity);
    scene.add(ambientLight);

    // --- 3. PISO CON TEXTURA ---
    const textureLoader = new THREE.TextureLoader();
    const pisoTextura = textureLoader.load('Piso.jpg');
    pisoTextura.wrapS = pisoTextura.wrapT = THREE.RepeatWrapping;
    pisoTextura.repeat.set(10, 10);

    const pisoGeo = new THREE.PlaneGeometry(2000, 2000);
    const pisoMat = new THREE.MeshStandardMaterial({ map: pisoTextura, roughness: 0.8 });
    const pisoMesh = new THREE.Mesh(pisoGeo, pisoMat);
    pisoMesh.rotation.x = -Math.PI / 2;
    pisoMesh.receiveShadow = true;
    scene.add(pisoMesh);

    // --- 4. CARGA DEL MODELO FBX ---
    const fbxLoader = new FBXLoader();
    // const skinAcheron = textureLoader.load('../textures/Acheron.png'); // Cargada pero no aplicada aún

    fbxLoader.load('Dancing Twerk.fbx', function (object) {
        model = object;
        mixer = new THREE.AnimationMixer(object);
        if (object.animations.length > 0) {
            mixer.clipAction(object.animations[0]).play();
        }

        object.traverse(function (child) {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    // map: skinAcheron, <--- COMENTADO para que el color base y el metal funcionen
                    color: params.color,
                    metalness: params.metalness,
                    roughness: params.roughness
                });
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(object);
    });

    // --- 5. AUDIO CORREGIDO ---
    const listener = new THREE.AudioListener();
    camera.add(listener);
    sound = new THREE.Audio(listener);
    
    new THREE.AudioLoader().load('IMPACTA.mp3', function(buffer) {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.5);
    });

    // --- 6. INTERFAZ DE USUARIO (GUI) ---
    const gui = new GUI();
    
    const lightFolder = gui.addFolder('Iluminación');
    lightFolder.add(params, 'lightIntensity', 0, 10).name('Luz Dir.').onChange(v => dirLight.intensity = v);
    lightFolder.add(params, 'ambientIntensity', 0, 2).name('Luz Amb.').onChange(v => ambientLight.intensity = v);
    
    const matFolder = gui.addFolder('Material Modelo');
    matFolder.addColor(params, 'color').name('Color').onChange(v => {
        if(model) model.traverse(child => { 
            if(child.isMesh) {
                child.material.color.set(v); 
                child.material.needsUpdate = true;
            }
        });
    });
    matFolder.add(params, 'metalness', 0, 1).name('Metalicidad').onChange(v => {
        if(model) model.traverse(child => { if(child.isMesh) child.material.metalness = v; });
    });
    matFolder.add(params, 'roughness', 0, 1).name('Rugosidad').onChange(v => {
        if(model) model.traverse(child => { if(child.isMesh) child.material.roughness = v; });
    });

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize);
    
    // FORZAR DESBLOQUEO DE AUDIO AL CLIC
    window.addEventListener('click', () => { 
        const audioCtx = THREE.AudioContext.getContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume(); // Despierta el motor de audio del navegador
        }
        if (sound && !sound.isPlaying && sound.buffer) {
            sound.play(); 
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    if (mixer) mixer.update(clock.getDelta());
    renderer.render(scene, camera);
}