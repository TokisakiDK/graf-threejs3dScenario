import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let camera, scene, renderer, mixer, sound, model;
const clock = new THREE.Clock();

// Parámetros iniciales optimizados para el ITP
const params = {
    color: 0x00ffcc,     // Cian neón inicial
    metalness: 0.1,      // Bajo para que no sea un espejo puro
    roughness: 0.7,      // Alto para que el color sea visible
    lightIntensity: 2.5, // Luz visible desde el inicio
    ambientIntensity: 0.5
};

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 300);

    scene = new THREE.Scene();

    // --- 1. CARGA DEL ESCENARIO 2K ---
    new EXRLoader().load('ferndale_studio_12_2k.exr', function (texture) {
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

    // --- 3. PISO ---
    const textureLoader = new THREE.TextureLoader();
    const pisoTextura = textureLoader.load('Piso.jpg');
    pisoTextura.wrapS = pisoTextura.wrapT = THREE.RepeatWrapping;
    pisoTextura.repeat.set(10, 10);
    const pisoMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshStandardMaterial({ map: pisoTextura, roughness: 0.8 })
    );
    pisoMesh.rotation.x = -Math.PI / 2;
    pisoMesh.receiveShadow = true;
    scene.add(pisoMesh);

    // --- 4. CARGA DEL MODELO FBX ---
    const fbxLoader = new FBXLoader();

    fbxLoader.load('Dancing Twerk.fbx', function (object) {
        model = object;
        mixer = new THREE.AnimationMixer(object);
        if (object.animations.length > 0) mixer.clipAction(object.animations[0]).play();

        object.traverse(function (child) {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
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

    // --- 5. AUDIO ---
    const listener = new THREE.AudioListener();
    camera.add(listener);
    sound = new THREE.Audio(listener);
    new THREE.AudioLoader().load('IMPACTA.mp3', function(buffer) {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.5);
    });

    // --- 6. PANEL DE CONTROL (GUI) ---
    const gui = new GUI();
    const fLight = gui.addFolder('Iluminación');
    fLight.add(params, 'lightIntensity', 0, 10).name('Luz Dir.').onChange(v => dirLight.intensity = v);
    
    const fMat = gui.addFolder('Material Modelo');
    fMat.addColor(params, 'color').name('Color').onChange(v => {
        if(model) model.traverse(c => { if(c.isMesh) c.material.color.set(v); });
    });
    fMat.add(params, 'metalness', 0, 1).name('Metalicidad').onChange(v => {
        if(model) model.traverse(c => { if(c.isMesh) c.material.metalness = v; });
    });
    fMat.add(params, 'roughness', 0, 1).name('Rugosidad').onChange(v => {
        if(model) model.traverse(c => { if(c.isMesh) c.material.roughness = v; });
    });

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.setAnimationLoop(() => {
        if (mixer) mixer.update(clock.getDelta());
        renderer.render(scene, camera);
    });
    container.appendChild(renderer.domElement);

    new OrbitControls(camera, renderer.domElement).target.set(0, 100, 0);

    // ACTIVACIÓN DE AUDIO Y RESUME DE CONTEXTO
    window.addEventListener('click', () => { 
        const audioCtx = THREE.AudioContext.getContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (sound && !sound.isPlaying && sound.buffer) sound.play(); 
    }, { once: true });
}