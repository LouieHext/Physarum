// ====================
// Physarum Simulation
//=====================
//This project explores emergent properties of complex systems via a 
//Physarum polycephalum Slime Mould simulation. The system is a collection
// of agents moving around. As they move they deposit a trail of chemicals
// or pheromones behind them. Importnatly the direction of agents id determined
//by  nearby pheromone intensity. This creates a feedback loop between the
// pheromone map and the individual agents, leading to complex structures and 
//networks forming. This is an emergent behaviour as the details of the agents
//and their behaviours hold no information to do with these structures.
//To show case this emergent behaviour a food map is added. Agents will
//be attracted to food and and pheromones. We map the location of food
//to french cities using a geographica data set of city locations and
//populations. The agents then explore the map, seeking out food, and form
//an effecient transport network.

//the simulation can either be run in geographic mode, showcasing this property
//or in free mode (no food) which showcases the visual and dyanmics of the paths.
//A gui is added allowing you to adjust paramters in real time.

//I recommend using 400x400 if you wish to play in real time (zoom in, or
//increase the canvas size to 800x800 stretching the image).
//You can try HD but it will slow down

//some important paramters to adjust
// sensor distance and angle. These have a large impact on the structures formed
//agent turn rate and agent speed also impact the structures and the evolution of 
//the system.

// ====================
// Optionals: these can change the visual outcome of the simulation
//=====================

//diffusion is the gradual spreading of agent chemicals to the surroundings.
//this seems to alter the growth rate of the systems and give a slightly different
//aesthetic to the visuals. With diffusion enabled lines are more "smooth".
//It also slows it down. Personally I like the asthetic without the diffusion
// (and the speed (I wish I had used a frag shader for this, I did not know
// that p5.js supported them until I had done a lot of this code)).
const diffusion = false;
//this changes the setup from a blank canvas to one in which there is food for the
//agents. Importantly this food is spread out based on geographical data.
//In this case a data set of french cities (well anything with more than 5000 people
//is used). The lat and long are used to place them, and the population controls
//how much food is at those coords. Enable "drawFood" if you wish to see
// this. However it is basically just a population density map of france.
const geographic = true;

//this enables a gui which controls the system paramters. I highly suggest having a
//play with this, its very fun to watch the system change in real time based on your
//paramters.
const drawGui = true;

//displays the static food map instead of the agents
const drawFood = false;

//saves each frame. Useful for making a HD image/animation.
//frames can be combined to make an mp4 for example.
const saveImages = false;


//changes between 400x400 and 1080x1080. This is useful for the geographic mode which 
//relies on image data. If you are not using the geographic mode feel free to 
//over ride the width and height.
//if using HD you willl also need more particles
// HD maybe 30-100k
// non HD maybe 5-20k
//lower particles need higher deposit amount for visuals
//higher less
const HD = false;

//if true the agents start in a point at the centre
//if not they start in a square region
const pointStart=false;

// ====================
// Simulation Paramaters: these can change be edited with the GUI
//=====================

let params = {
  // agent speed
  //how far an angent moves each update
  speed: 3.4,
  speedMin: 0.1,
  speedMax: 20,
  speedStep: 0.1,

  //agent turning speed
  //how many radian an agent may turn in an update
  turningSpeed: 0.64,
  turningSpeedMin: 0.01,
  turningSpeedMax: 3.141,
  turningSpeedStep: 0.01,

  //agent chemical deposit
  //how many "chemicals" an agent leaves behind each update
  deposit: 0.99,
  depositMin: 0.01,
  depositMax: 1,
  depositStep: 0.01,

  //agent food desire
  //the strength of the agents food attractive rather than chemical
  //attraction to other agent trails
  agentFoodDesire: 8.3,
  agentFoodDesireMin: 0.001,
  agentFoodDesireMax: 10,
  agentFoodDesireStep: 0.01,

  //number of Agents
  numAgents: 10000,
  numAgentsMin: 1,
  numAgentsMax: 200000,
  numAgentsStep: 100,

  //sensor angle
  //the angle of the left and right sensors
  sensorAngle: 0.52,
  sensorAngleMin: 3.141 / 360,
  sensorAngleMax: 3.141,
  sensorAngleStep: 3.141 / 360,

  //sensor size
  //the kernel size of the sensors
  sensorSize: 1,
  sensorSizeMin: 1,
  sensorSizeMax: 4,
  sensorSizeStep: 1,

  //sensor distance
  //how many units in front the agents sense
  //this controls the scale of the sturctures formed
  sensorDistance: 10,
  sensorDistanceMin: 1,
  sensorDistanceMax: 50,
  sensorDistanceStep: 1,

  //decay factor
  //how much the values decrease by (1-value) this frame
  //this stops the system being overran by chemicals
  decayFactor: 0.01,
  decayFactorMin: 0.01,
  decayFactorMax: 1,
  decayFactorStep: 0.01,
};


// ====================
// Global Variables
//=====================

let gui; //object for gui library
let Agents = []; //array for storing agents/particles
let W;
let H;
let img; //stores pixel data for visualisation
let trail; //global variable for chemical/pheromone data
let food; //global variable for chemical/pheromone data

//diffusion spreading weights
let weights = [
  0.0125,
  0.025,
  0.0125,
  0.025,
  0.85,
  0.025,
  0.0125,
  0.025,
  0.0125,
];

//geographical data
let mapData;
let table;

// ====================
// Agent class: controls the update and behaviour of the agents
//=====================

class Agent {
  constructor(_x, _y) {
    this.x = _x;
    this.y = _y;
    this.heading = Math.random() * 2 * 3.141;
  }

  // retuns the coords (array indices)
  //effectively extends a vector of length sensorDistance form the current
  //position at an angle of the current heading + the input theta.
  getSensedRegion(theta) {
    const x = Math.round(
      this.x + params.sensorDistance * Math.cos(this.heading + theta)
    );
    const y = Math.round(
      this.y + params.sensorDistance * Math.sin(this.heading + theta)
    );
    return [x, y];
  }

  //returns the combined value of food and chemicals at the given coords (array indices).
  //large values are "attractive" and low values "repulsive". The agent food desire
  //impacts how much more the agent values food than other agents trails
  getSensedValue(pos) {
    let value = 0;
    for (let i = -params.sensorSize; i < params.sensorSize; i++) {
      for (let j = -params.sensorSize; j < params.sensorSize; j++) {
        value += trail[pos[0] + i + (pos[1] + j) * W]; //2D -> 1D
        value += food[pos[0] + i + (pos[1] + j) * W] * params.agentFoodDesire;
      }
    }
    return value;
  }

  //updates the agents heading based on the infomation from the trails and food

  updateHeading() {
    //checking left and right regions.
    const senseLeft = this.getSensedValue(
      this.getSensedRegion(params.sensorAngle)
    );
    const senseForward = this.getSensedValue(this.getSensedRegion(0));
    const senseRight = this.getSensedValue(
      this.getSensedRegion(-params.sensorAngle)
    );

    //moving right
    if (senseRight > senseLeft && senseRight > senseForward) {
      this.heading -= params.turningSpeed;
    }
    //moving left
    if (senseLeft > senseRight && senseLeft > senseForward) {
      this.heading += params.turningSpeed;
    }

    // if heading into an negative area, turn around
    if (senseForward < 0) {
      this.heading += PI;
    }
  }

  //standard position update function
  //velocity of magnitude params.speeed with direction given by heading
  updatePos() {
    this.x = this.x + params.speed * Math.cos(this.heading);
    this.y = this.y + params.speed * Math.sin(this.heading);
  }
  //applies periodic boundary conditions
  //this captures all possiblities without the need for conditionals
  // i.e (-5 + W)%W=(W-5)%W=W-5;
  // and (W+5+W)%W=(2W+5)%W=5;
  boundaryCheck() {
    this.x = (this.x + W) % W;
    this.y = (this.y + H) % H;
  }
  //updating the heading, the position and applying boundary conditions
  update() {
    this.updateHeading();
    this.updatePos();
    this.boundaryCheck();
  }
}




// ====================
// Setup,reset and draw functions
//=====================


function preload() {
  //preloading in geogrpahical data
  if (HD){
    mapData = loadImage("france1080.png");
  }
  if (!HD){
    mapData=loadImage("france.png");
  }
  
  table = loadTable("franceall.csv", "csv");
}

function setup() {
  if (HD){
  createCanvas(1080, 1080);
   //setting width of arrays
   W = 1080;
   H = 1080;
  }
  if (!HD){
    createCanvas(400, 400);
   //setting width of arrays
   W = 400;
   H = 400;
  }

  if (drawGui) {
    gui = createGui("simParams");
    gui.addObject(params);
  }
 
  reset(); //populating arrays
  img = createGraphics(W, H);
  img.pixelDensity(1);
}

function draw() {
  updateAgents(); //updating Agent positions and headings
  updateTrail(); //updating chemical trail
  viewTrail(); //visualing trail
  if (drawFood) {
    viewFood();
  }
  image(img, 0, 0, width, height)  ; //drawing image
  if (saveImages) {
    save(img,str(frameCount) + ".png");
  }
}


//resets the trail and food arrays
//resets the agent positios and headings
//essentially loads up the default state of the
//fresh simulation
function reset() {
    //loads up an array of floats of the relevant size
    //easy and fast way of initalising the arrays
    trail = new Float32Array(W * H);
    food = new Float32Array(W * H);
  
    //loads up agent array
    Agents = [];
    for (let i = 0; i < params.numAgents; i++) {
      if (pointStart){
      Agents.push(new Agent(W*0.5,H*0.5));
    }
    else{
      Agents.push(new Agent(W*(0.4+Math.random()*0.2),H*(0.4+Math.random()*0.2)));
    }

  }
  
    //adds a negative food border that keeps the
    //agents away from the borders as I dont
    //like the structures that the periodic boundaries
    //lead to. the "reflection" is also quite cool
    addNegativeFoodBorder();

    //adds in the geographical food data
    if (geographic) {
      addNegativeFoodImage();
      getGeoDataFood();
    }
}


// ====================
// Simulation Update Functions
//=====================


//updating each of the agents
function updateAgents() {
  for (a of Agents) {
    a.update();
  }
}

//updating the trail by depositing the agents
//and diffusing and decaying the trail values
function updateTrail() {
  depositAgentChems();
  diffuseAndDecayTrail();
}

//increases the trail map at the locations of the agents
function depositAgentChems() {
  for (a of Agents) {
    trail[Math.round(a.x) + Math.round(a.y) * W] += params.deposit;
  }
}

//uses a 3x3 kernel approach to diffuse the trail values to their surroundings
//the kenrel is specified by weights. 
//each cell is also decayed to prevent a bulild up

function diffuseAndDecayTrail() {
  const oldTrail = Float32Array.from(trail);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const value = oldTrail[x + y * W];
      trail[x + y * W] = value * (1 - params.decayFactor) * weights[4]; //avoiding adding to the current position
      if (diffusion) { //diffusion is slightly messed up for the edges, however we usually place
                       //a negative food border around the edges preventing the agents from getting there
                       //so this slight mess up near the edges doesnt impact the results. 
                       //so we save time by not checking if each coord is on the border.
        trail[x - 1 + (y - 1) * W] += value * weights[0];
        trail[x + (y - 1) * W] += value * weights[1];
        trail[x + 1 + (y - 1) * W] += value * weights[2];
        trail[x - 1 + y * W] += value * weights[3];
        trail[x + 1 + y * W] += value * weights[5];
        trail[x - 1 + (y + 1) * W] += value * weights[6];
        trail[x + (y + 1) * W] += value * weights[7];
        trail[x + 1 + (y + 1) * W] += value * weights[8];
      }
    }
  }
}


// ====================
// Render Functions
//=====================

//loadings in the trail data and uses it to update
//each pixel in the the grid based on its value
function viewTrail() {
  img.loadPixels(); //loading pixels
  let index = 0;
  for (let x = 0; x < W; x++) {
    //looping over grid
    for (let y = 0; y < H; y++) {
      index = x + y * W; //2D -> array index
      const brightness = trail[index] * 255; //*255 (rgb does mapping)
      index *= 4; //as r,g,b,a
      //arbitary colour based on brightness
      img.pixels[index + 0] = brightness;
      img.pixels[index + 1] = brightness/5;
      img.pixels[index + 2] = brightness*brightness/200;
      img.pixels[index + 3] = 255;
    }
  }
  img.updatePixels(); //updating pixels
}

  //loadings in the trail data and uses it to update
  //each pixel in the the grid based on its value
  //essentially the same as the above function
function viewFood() {
  img.loadPixels();
  let index = 0;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      index = x + y * W; //2D -> array index
      const brightness = map(food[index], -100, 200, 0, 1, true) * 255; //mapping as food can be negative
      index *= 4; //as r,g,b,a
      img.pixels[index + 0] = brightness;
      img.pixels[index + 1] = brightness;
      img.pixels[index + 2] = brightness;
      img.pixels[index + 3] = 255;
    }
  }
  img.updatePixels();
}


// ====================
// Food map Functions
//=====================

// loads in the geographical data
// the lat and long are mapped to pixel coords
// the population size maps to the food values
function getGeoDataFood() {



  let parisY = 123 ; //setting paris pixel values as a reference
  let parisX = 232 ;
  
  if (HD){
    parisY *= 2.5; //setting paris pixel values as a reference
    parisX *= 2.5; //(1080/400 is 2.5 ish)
  }
 
  const realParisY = table.getString(0, 1);
  const realParisX = table.getString(0, 2);

  //getting conversion of lat and long to x and y pixels
  const [scaleLat, scaleLong] = getScale();

  for (let r = 0; r < table.getRowCount(); r++) {
    const tempY = table.getString(r, 1); //loading values
    const tempX = table.getString(r, 2);
    const y = (realParisY - tempY) * scaleLong + parisY; //mapping difference from paris
    const x = (realParisX - tempX) * scaleLat + parisX; //in lat long to difference in pixel coords
    const foodValue = map(table.getString(r, 3), 0, 12000000, 10, 1000); //max population, min population (5k)
    addFood(x, y, foodValue); //adding food
  }
}

//finds the range of lat long and maps them onto W and H
function getScale() {
  let maxX = 0;
  let minX = 100;
  let maxY = 0;
  let minY = 100;

  //finding max and min values for lat and long coords
  for (let r = 0; r < table.getRowCount(); r++) {
    const tempY = parseFloat(table.getString(r, 1));
    const tempX = parseFloat(table.getString(r, 2));
    if (tempX > maxX) {
      maxX = tempX;
    }
    if (tempY > maxY) {
      maxY = tempY;
    }
    if (tempX < minX) {
      minX = tempX;
    }
    if (tempY < minY) {
      minY = tempY;
    }
  }

  //getting scales, 0.92 as map doesnt take up whole image
  scaleLat = -(W * 0.92) / (maxX - minX); //how many lat degrees is one pixel across
  scaleLong = (W * 0.92) / (maxY - minY); //how many long degrees is one pixel down
  return [scaleLat, scaleLong];
}



//adds food to the food map at specific coords in a circle of radius 5
//could be modified to scale radius with population also
function addFood(x, y, value, rad = 5) {

  for (let r = 1; r < rad; r++) { //loop through radius
    for (let i = 0; i < 100; i++) { //theta for polar coords
      const theta = map(i, 0, 100, 0, 2 * PI);
      food[ //at x + Y*W
        Math.round(x + r * Math.cos(theta)) +
        Math.round(y + r * Math.sin(theta))* W
          ] += value;
    }
  }
}

//adds a negative food border at the outermost 20 edges
//this negative food border keep the agents away
//I do this to avoid periodic boundary conditions 
//and to easily implement reflective ones
function addNegativeFoodBorder() {
  //left
  for (let x = 0; x < 20; x++) {
    for (let y = 0; y < H; y++) {
      food[x + y * W] -= 100;
    }
  }
  //right
  for (let x = W - 20; x < W; x++) {
    for (let y = 0; y < H; y++) {
      food[x + y * W] -= 100;
    }
  }
  //top
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < 20; y++) {
      food[x + y * W] -= 100;
    }
  }
  //bottom
  for (let x = 0; x < W; x++) {
    for (let y = H - 20; y < H; y++) {
      food[x + y * W] -= 100;
    }
  }
}


//this uses an image to create a more complicated boundary.
//the image is assumed to be black and white, with black being
//the region of permitted travel and white being forbidden.
//negative food is added to all pixels that are white
//this assumes that the image and canvas are the same dimension
//in doing so we can stop the agents walking into the sea
//or neighbouring countries in our geographical idea
//or create intresting shapes
function addNegativeFoodImage() {
  mapData.loadPixels(); //loading image data
  for (let x = 0; x < mapData.width; x++) {
    for (let y = 0; y < mapData.height; y++) {
      const index = (x + mapData.width * y) * 4; //r,g,b,a
      const r = mapData.pixels[index + 0];
      const g = mapData.pixels[index + 1];
      const b = mapData.pixels[index + 2];
      const c = (r + g + b) / 3; //brightness estimate
      if (c > 220) { //if white add food
        food[x + mapData.width * y] -= 200;
      }
    }
  }
}


// ====================
// utility functions
//=====================

//used for resetting and saving the simulation
function keyPressed() {
  if (key === "r") {
    reset();
  }
  if (key === "s") {
    save("good.png");
  }
}
