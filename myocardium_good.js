import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';

// Find height of navigation
const navHeight = document.querySelector('.topnav').offsetHeight+document.querySelector('.nav-title').offsetHeight;

// Global Variables
let renderer, camera, controls, helper, clock, loadedGLB;
let myocytesGLB, vesselsGLB; // Separate variables for each model
let materials = []; // Store materials for color change
let colorChanging_flow = false; // State for color changing
let colorChanging_Hb = false; // State for color changing
let colorChangeInterval; // Store the interval for color changing

// Setup Three.js renderer
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.autoClear = false;
renderer.setClearColor(0xffffff); // Set background to white
renderer.setSize(window.innerWidth, window.innerHeight-navHeight);
document.body.appendChild(renderer.domElement);

// Create camera and controls
camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;

// Create two scenes
const glbScene = new THREE.Scene();
glbScene.background = new THREE.Color(0xe5e7e9); 

// Create a local clipping plane
const localPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const localPlaneY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const localPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 5);


// Create GLTFLoader instance
const loader = new GLTFLoader();


// Function to load and add a model to the scene
function loadModel(filePath, onLoadCallback) {
    console.log('Attempting to load model from:', filePath); // Log the file path

    loader.load(
        filePath, 
        (gltf) => {
            console.log('Model loaded successfully from:', filePath);

            // Adjust model scale and position
            gltf.scene.scale.set(0.01, 0.01, 0.01);
            gltf.scene.rotation.x = Math.PI / 2; // Rotate 90 degrees around X-axis
            
            // Compute the bounding box to center the model
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            gltf.scene.position.z -= 5;

            // Add clipping planes to meshes
            gltf.scene.traverse((child) => {
                if (child.isMesh && child.material.isMeshStandardMaterial) {
                    child.material.clipShadows = true;
                    child.material.needsUpdate = true;
                }
            });

            // Add the model to the scene
            glbScene.add(gltf.scene);

            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    if (child.material.isMeshStandardMaterial) {
                        child.material.clippingPlanes = [localPlaneZ];
                        child.material.clipShadows = true;
                        child.material.needsUpdate = true;
                    }
                }
            });

            // Call the callback to store the model in a global variable
            onLoadCallback(gltf);

            // Set the camera to look at the first loaded model's center
            camera.position.set(6, 3, 6);
            camera.lookAt(center);

            console.log('Model added to the scene and callback executed.');
        },
        (xhr) => {
            // Log loading progress
            if (xhr.total) {
                console.log(`${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded from: ${filePath}`);
            } else {
                console.log(`Loading progress: ${xhr.loaded} bytes loaded.`);
            }
        },
        (error) => {
            // Detailed error logging
            console.error('An error occurred while loading:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
            }
        }
    );
}



// Load Myocytes GLB model

loadModel('https://floutistflower.github.io/Myocytes/3DModels-main/myocytes_only.glb', (gltf) => {
    myocytesGLB = gltf; // Store the myocytes model globally
    myocytesGLB.scene.visible = false;
    console.log('Myocytes model loaded and stored globally.');
});


//Load Myocytes cap model
loadModel('https://floutistflower.github.io/3DModels/myocyteTest.glb', (gltf) => {
myocyteCapsGLB = gltf; // Store the myocytes model globally
    myocyteCapsGLB.scene.visible = true;
    console.log('Myocyte caps model loaded and stored globally.');
});


let sortedMaterials = []; // Declare a global variable for sorted materials

// Load Vessels GLB model
loadModel('https://floutistflower.github.io/3DModels/segments2.glb', (gltf) => {
    vesselsGLB = gltf; // Store the vessels model globally
    vesselsGLB.scene.visible = true;

    // Log material details for vessels
    //vesselsGLB.scene.traverse((child) => {
    //    if (child.isMesh && child.material.isMeshStandardMaterial) {
    //        console.log(child.material.name, materials.indexOf(child.material));
    //    }
    //});

    // Sort the materials after extraction
    const sortedNames = customSort(materials.map(m => m.name));
    //console.log('Sorted Material Names:', sortedNames);

    // Create the sorted materials array
    sortedMaterials = sortedNames.map(name => materials.find(m => m.name === name));
    //console.log('Sorted Materials:', sortedMaterials);

    IDColor();
});

let factors_Hb = [];
let factors_flow = [];

// Load factors from CSV
loadFactors('https://vsturgess.github.io/3DModels/OSS1147_HBO2_SAT_ENDO_UNEVEN.csv').then(loadedFactors => {
    factors_Hb = loadedFactors;
    console.log('Loaded Hb factors:', factors_Hb);
});

loadFactors('https://vsturgess.github.io/3DModels/OSS1147_Endoflows_Save.csv').then(loadedFactors => {
    factors_flow = loadedFactors;
    console.log('Loaded flow factors:', factors_flow);
});

let ID_factors = [];
// Load factors from CSV
loadFactors('https://vsturgess.github.io/3DModels/IdentifyInOut_Vessels.csv').then(loadedFactors => {
    ID_factors = loadedFactors;
    console.log('Loaded factors:', ID_factors);
});

let defaultColors = []; // Store default colors

// Function to extract materials
function extractMaterials(gltf) {
    gltf.scene.traverse((child) => {
        if (child.isMesh && child.material.isMeshStandardMaterial) {
            materials.push(child.material);
            defaultColors.push(child.material.color.clone()); // Store the original color
        }
    });
}

// Function to sort material names numerically based on the part after the underscore
function customSort(materialNames) {
    return materialNames.sort((a, b) => {
        const aParts = a.split('_');
        const bParts = b.split('_');

        // Compare the part before the underscore (as strings)
        const nameComparison = aParts[0].localeCompare(bParts[0]);

        if (nameComparison !== 0) {
            return nameComparison; // Sort by name part first
        }

        // Parse the numerical part after the underscore (if it exists)
        const aNum = aParts[1] ? parseInt(aParts[1], 10) : 0;
        const bNum = bParts[1] ? parseInt(bParts[1], 10) : 0;

        return aNum - bNum; // Sort numerically by the number
    });
}

// Function to start ID color assignment
function IDColor() {
    if (ID_factors.length === 0 || sortedMaterials.length === 0) return; // Ensure factors and sorted materials are loaded

    // Loop through the sorted materials and apply color based on factors
    sortedMaterials.forEach((material, index) => {
        if (material && material.isMeshStandardMaterial && ID_factors[index] !== undefined) {
            const ID_factor = ID_factors[index]; // Get the factor for this material


            if (ID_factor == 1) {
                material.color.set(0xff0000); // Set color to red
            } else if (ID_factor == 0.5) {
                material.color.set(0x000000); // Set color to black
            } else if (ID_factor == 0) {
                material.color.set(0x0000ff); // Set color to blue
            }
        } else {
            console.warn(`Material or factor missing for index: ${index}`);
        }
    });
}


// Show or hide the scale bar when color-changing is activated
function toggleScaleBar_Hb(show) {
    const scaleBar = document.querySelector('.scale-bar-container');
    scaleBar.style.display = show ? 'block' : 'none';
    
    if (show) {
      scaleBar.style.background = 'linear-gradient(to top, blue, red)'; // Adjust the color gradient as needed
    }
  }
  
  function toggleScaleBar_flow(show) {
    const scaleBar = document.querySelector('.scale-bar-container');
    scaleBar.style.display = show ? 'block' : 'none';
  
    if (show) {
      scaleBar.style.background = 'linear-gradient(to top, blue, cyan, green, yellow, red)'; // Jet color scheme;
    }
  }

function updateScaleBarLabels(type) {
    const topLabel = document.getElementById('topLabel');
    const bottomLabel = document.getElementById('bottomLabel');

    if (type === 'Hb') {
        topLabel.textContent = '100%'; // Change as needed
        bottomLabel.textContent = '0%'; // Change as needed
    } else if (type === 'flow') {
        topLabel.textContent = '1e-1 nL/s'; // Change as needed
        bottomLabel.textContent = '1e-5 nL/s'; // Change as needed
    }
}

// Modify the startColorChanging function if necessary
function startColorChanging_Hb() {
    stopColorChanging_flow()
    toggleScaleBar_Hb(true);
    updateScaleBarLabels('Hb'); // Update labels for Hb scheme
    if (factors_Hb.length === 0 || sortedMaterials.length === 0) return; // Ensure factors and sorted materials are loaded

    let step = 0; // Step counter
    const totalTimeSteps = factors_Hb[0].length; // Number of time steps

    colorChangeInterval = setInterval(() => {
        step = step % totalTimeSteps; // Loop through time steps

        // Loop through the sorted materials and apply color based on factors
        sortedMaterials.forEach((material, index) => {
            if (material && material.isMeshStandardMaterial && factors_Hb[index]) {
                const factor = factors_Hb[index][step]; // Get the factor for this material
                const startColor = new THREE.Color(0, 0, 1); // Red
                const endColor = new THREE.Color(1, 0, 0); // Blue

                // Interpolate between red and blue based on the factor value
                const newColor = interpolateColor(startColor, endColor, factor);
                material.color.copy(newColor); // Set the material's color
            } else {
                console.warn(`Material or factor missing for index: ${index}`);
            }
        });

        step++;
    }, 40); // Change color every 40ms
}

// Modify the startColorChanging function if necessary
function startColorChanging_flow() {
    stopColorChanging_Hb()
    toggleScaleBar_flow(true);
    updateScaleBarLabels('flow'); // Update labels for flow scheme
    if (factors_Hb.length === 0 || sortedMaterials.length === 0) return; // Ensure factors and sorted materials are loaded

    let step = 0; // Step counter
    const totalTimeSteps = factors_flow[0].length; // Number of time steps

    colorChangeInterval = setInterval(() => {
        step = step % totalTimeSteps; // Loop through time steps

        // Loop through the sorted materials and apply color based on factors
        sortedMaterials.forEach((material, index) => {
            if (material && material.isMeshStandardMaterial && factors_flow[index]) {
                const factor = factors_flow[index][step]; // Get the factor for this material
                // Define colors for the jet color scheme
                const startColor = new THREE.Color(0, 0, 1); // Blue
                const midColor1 = new THREE.Color(0, 1, 1); // Cyan
                const midColor2 = new THREE.Color(0, 1, 0); // Green
                const midColor3 = new THREE.Color(1, 1, 0); // Yellow
                const endColor = new THREE.Color(1, 0, 0); // Red

                // Interpolate color based on the factor
                let newColor;
                if (factor < 0.25) {
                    newColor = interpolateColor(startColor, midColor1, factor * 4); // Interpolating from Blue to Cyan
                } else if (factor < 0.5) {
                    newColor = interpolateColor(midColor1, midColor2, (factor - 0.25) * 4); // Interpolating from Cyan to Green
                } else if (factor < 0.75) {
                    newColor = interpolateColor(midColor2, midColor3, (factor - 0.5) * 4); // Interpolating from Green to Yellow
                } else {
                    newColor = interpolateColor(midColor3, endColor, (factor - 0.75) * 4); // Interpolating from Yellow to Red
                }
                material.color.copy(newColor); // Set the material's color
            } else {
                console.warn(`Material or factor missing for index: ${index}`);
            }
        });

        step++;
    }, 40); // Change color every 40ms
}

// Function to stop color changing and set materials to black
function stopColorChanging_Hb() {
    toggleScaleBar_Hb(false);
    clearInterval(colorChangeInterval); // Clear the interval
    IDColor();
}

// Function to stop color changing and set materials to black
function stopColorChanging_flow() {
    toggleScaleBar_flow(false);
    clearInterval(colorChangeInterval); // Clear the interval
    IDColor();
}

let activeColorChange = null; // Track which color change mode is active

function toggleColorChanging(mode) {
    if (activeColorChange === mode) {
        // If the same mode is clicked, stop it
        if (mode === 'Hb') {
            stopColorChanging_Hb();
        } else if (mode === 'flow') {
            stopColorChanging_flow();
        }
        activeColorChange = null; // Reset active mode
    } else {
        // Stop the other mode if it's active
        if (activeColorChange === 'Hb') {
            stopColorChanging_Hb();
        } else if (activeColorChange === 'flow') {
            stopColorChanging_flow();
        }

        // Start the new mode
        if (mode === 'Hb') {
            startColorChanging_Hb();
        } else if (mode === 'flow') {
            startColorChanging_flow();
        }
        activeColorChange = mode; // Set the active mode
    }
}



// Function to interpolate color based on factor
function interpolateColor(color1, color2, factor) {
    return color1.clone().lerp(color2, factor);
}

// Load factors from CSV and parse into a 2D array
async function loadFactors(filePath) {
    const response = await fetch(filePath);
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');

    // Parse factors into a 2D array (each row is a vessel)
    //const factors = lines.slice(1).map(line => line.split(',').map(parseFloat)); // Skip header and parse each row
    const factors = lines.map(line => line.split(',').map(parseFloat)); // Parse all rows


    return factors;
}

// Lighting for the GLB scene
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaaaaa);
glbScene.add(hemiLight);


// Axes Helper in the GLB scene
//glbScene.add(new THREE.AxesHelper(20));

// View Helper
helper = new ViewHelper(camera, renderer.domElement);
helper.controls = controls;
helper.controls.center = controls.target;

// UI Element for View Helper
const div = document.createElement('div');
div.id = 'viewHelper';
div.style.position = 'absolute';
div.style.right = 0;
div.style.bottom = 0;
div.style.height = '128px';
div.style.width = '128px';
document.body.appendChild(div);
div.addEventListener('pointerup', (event) => helper.handleClick(event));

// GUI for controlling the clipping plane
const gui = new GUI();
gui.domElement.style.position = 'absolute'; // Set position to absolute
gui.domElement.style.top = `${navHeight}px`; // Move GUI down by navHeight
gui.domElement.style.right = '0px'; // Optional: adjust position
document.body.appendChild(gui.domElement); // Append GUI to the body


const modelVisibility = {
    showMyocytes: false, // Initially visible
    showVessels: true,  // Initially visible
};

const ColorChange_Flow = {
    startColorChange_flow: () => {
        if (!colorChanging_flow) {
            colorChanging_flow = true;
            startColorChanging_flow();
        } else {
            colorChanging_flow = false;
            stopColorChanging_flow();
        }
    }
};

const ColorChange_Hb = {
    startColorChange_Hb: () => {
        if (!colorChanging_Hb) {
            colorChanging_Hb = true;
            startColorChanging_Hb();
        } else {
            colorChanging_Hb = false;
            stopColorChanging_Hb();
        }
    }
};
const props = {
    localClippingEnabled: true,
    z_plane: localPlaneZ.constant,
};

// GUI control to show/hide myocytes
gui.add(modelVisibility, 'showMyocytes').name('Show Myocytes').onChange((value) => {
    if (myocytesGLB) {
        myocytesGLB.scene.visible = value;
    }
});

// GUI control to show/hide vessels
gui.add(modelVisibility, 'showVessels').name('Show Vessels').onChange((value) => {
    if (vesselsGLB) {
        vesselsGLB.scene.visible = value;
    }
});



// GUI control to adjust the clipping plane position
gui.add(props, 'z_plane', -5, 5).onChange((value) => {
    localPlaneZ.constant = value; // Update the clipping plane position
    if (loadedGLB) {
        loadedGLB.scene.traverse((child) => {
            if (child.isMesh && child.material.isMeshStandardMaterial) {
                child.material.needsUpdate = true;
            }
        });
    }
});

// Object to track color changing state
const colorChangeState = {
    colorChanging_flow: false,
    colorChanging_Hb: false,
};


const ArterialInlet = {
    startChange: () => {
        camera.position.set(-1, 0.2, 0);
    }
};

const VenousOutlet1 = {
    startChange: () => {
        camera.position.set(0.7, 1.2, -4);
    }
};

const VenousOutlet2 = {
    startChange: () => {
        camera.position.set(1.5, 0.5, 4);
    }
};

const colorChangeControls = {
    startChange_flow: () => toggleColorChanging('flow'),
    startChange_Hb: () => toggleColorChanging('Hb')
};



// GUI control for flows
gui.add(colorChangeControls, 'startChange_flow').name('Show Flows in nL/s (log scale)');

// GUI control for Hb
gui.add(colorChangeControls, 'startChange_Hb').name('Show O2-Hemoglobin Saturation');


// GUI control to start/stop color changing
gui.add(ArterialInlet, 'startChange').name('Find Arterial Inlet');

// GUI control to start/stop color changing
gui.add(VenousOutlet1, 'startChange').name('Find Venous Outlet 1');

// GUI control to start/stop color changing
gui.add(VenousOutlet2, 'startChange').name('Find Venous Outlet 2');

// Set initial state to collapsed
gui.close(); // This will start the GUI collapsed

// Try help section
const infoIcon = document.getElementById('info-icon');
const popup = document.getElementById('popup');
const closeButton = document.getElementById('close-popup');

infoIcon.addEventListener('click', () => {
    popup.style.display = popup.style.display === 'none' || popup.style.display === '' ? 'block' : 'none';
});

closeButton.addEventListener('click', () => {
    popup.style.display = 'none';
});

// Clock
clock = new THREE.Clock();

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (helper.animating) helper.update(delta);
    controls.update();

    renderer.clear(); // Clear the renderer

    // Render the GLB scene
    renderer.render(glbScene, camera);
    
    // Render the View Helper
    helper.render(renderer); // Ensure this is rendering after the GLB scene
}

// Enable local clipping in the renderer
renderer.localClippingEnabled = true;
animate();
