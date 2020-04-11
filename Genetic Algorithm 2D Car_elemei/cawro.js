// Global Vars
var ghost;

var timeStep = 1.0 / 60.0; //real/fps sleeping

var doDraw = true;
var cw_paused = false;
var hide = 0;
var hideback = null; 
var sim_speed = null;

var box2dfps = 60; //physics fps
var screenfps = 60; //fps
var speednum = 1000; //default speed

var debugbox = document.getElementById("debug"); //debug line

var canvas = document.getElementById("mainbox"); //grahical simolution
var ctx = canvas.getContext("2d"); //

var graphcanvas = document.getElementById("graphcanvas"); //graphs
var graphctx = graphcanvas.getContext("2d");
var graphheight = 200;
var graphwidth = 400;

var minimapcanvas = document.getElementById("minimap"); //minimap 
var minimapctx = minimapcanvas.getContext("2d");
var minimapscale = 3; 
var minimapfogdistance = 0;
var minimarkerdistance = document.getElementById("minimapmarker").style;
var fogdistance = document.getElementById("minimapfog").style;

var generationSize = 20; //generaion
var cw_carGeneration = new Array(); //gen array	
var cw_carScores = new Array(); //scrore array
var cw_topScores = new Array(); //topscroe array
var cw_graphTop = new Array(); //gen top array
var cw_graphAverage = new Array(); //blue line graph

var gen_champions = 1; //clone size
var gen_parentality = 0.2; //parents kezdők 0 érték felül bírálás
var gen_mutation = 0.05; // used mutation
var gen_counter = 0;
var nAttributes = 14; // change this when genome changes (gén állomány)

var gravity = new b2Vec2(0.0, -9.81); //gravity vector value for 2dbox
var doSleep = true;

var world = new b2World(gravity, doSleep); //world

var defaultZoom = 70;
var zoom = defaultZoom; //zoom



var maxFloorTiles = 353; //max tiles and use this value to entropical generion
var cw_floorTiles = new Array();
var last_drawn_tile = 0;

var groundPieceWidth = 0.85; //talaj egység hossz
var groundPieceHeight = 0.15;

var chassisMaxAxis = 1.1;
var chassisMinAxis = 0.1;

var wheelMaxRadius = 0.5; //kerék sugár
var wheelMinRadius = 0.2;
var wheelMaxDensity = 100; //kerék nyomnaték
var wheelMinDensity = 40;
var wheelDensityRange = wheelMaxDensity + wheelMinDensity;

var maxVelocityFIFO = 50; //kszlet értékelés (firt in first out)
var velocityFIFO = new Array();
var velocityIndex = 0;
var deathSpeed = 0.1; //ha túl lassan megy az autó tartomány határrték
var max_car_health = box2dfps * 10;
var car_health = max_car_health;

var motorSpeed = 20;

var swapPoint1 = 0; //temp
var swapPoint2 = 0;

var cw_ghostReplayInterval = null; //árnyék megjelenítés

var distanceMeter = document.getElementById("distancemeter");

function debug(str, clear) {
  if(clear) {
    debugbox.innerHTML = "";
  }
  debugbox.innerHTML += str+"<br />";
}

function showDistance(distance, height) {
  distanceMeter.innerHTML = "Distance: "+distance+" meters<br />";
  distanceMeter.innerHTML += "Height: "+height+" meters";
  minimarkerdistance.left = ((distance + 5) * minimapscale) + "px";
  if(distance > minimapfogdistance) {
    fogdistance.width = 800 - (distance + 15) * minimapscale + "px";
    minimapfogdistance = distance;
  }
}

/* ========================================================================= */
/* === Car ================================================================= */
var cw_Car = function() {
  this.__constructor.apply(this, arguments);
}

cw_Car.prototype.chassis = null; //alváz
cw_Car.prototype.wheel1 = null; //kerék 1
cw_Car.prototype.wheel2 = null; //kerék 2

cw_Car.prototype.__constructor = function(car_def) {
  this.chassis = cw_createChassis(car_def.vertex_list);
  this.wheel1 = cw_createWheel(car_def.wheel_radius1, car_def.wheel_density1);
  this.wheel2 = cw_createWheel(car_def.wheel_radius2, car_def.wheel_density2);

  var carmass = this.chassis.GetMass() + this.wheel1.GetMass() + this.wheel2.GetMass(); // tömeg
  var torque1 = carmass * -gravity.y / car_def.wheel_radius1; //nyomaték 1
  var torque2 = carmass * -gravity.y / car_def.wheel_radius2; //nyomaték 2

  var joint_def = new b2RevoluteJointDef();
  var randvertex = this.chassis.vertex_list[car_def.wheel_vertex1];
  joint_def.localAnchorA.Set(randvertex.x, randvertex.y);
  joint_def.localAnchorB.Set(0, 0);
  joint_def.maxMotorTorque = torque1;
  joint_def.motorSpeed = -motorSpeed;
  joint_def.enableMotor = true;
  joint_def.bodyA = this.chassis;
  joint_def.bodyB = this.wheel1;

  var joint = world.CreateJoint(joint_def);

  randvertex = this.chassis.vertex_list[car_def.wheel_vertex2];
  joint_def.localAnchorA.Set(randvertex.x, randvertex.y);
  joint_def.localAnchorB.Set(0, 0);
  joint_def.maxMotorTorque = torque2;
  joint_def.motorSpeed = -motorSpeed;
  joint_def.enableMotor = true;
  joint_def.bodyA = this.chassis;
  joint_def.bodyB = this.wheel2;

  var joint = world.CreateJoint(joint_def);
}

cw_Car.prototype.getPosition = function() { //kocsi lerakás
  return this.chassis.GetPosition();
}

cw_Car.prototype.draw = function() { //kocsi ki rajzolás
  drawObject(this.chassis);
  drawObject(this.wheel1);
  drawObject(this.wheel2);
}

function cw_createChassisPart(body, vertex1, vertex2) { //alap részeinek építése
  var vertex_list = new Array();
  vertex_list.push(vertex1);
  vertex_list.push(vertex2);
  vertex_list.push(b2Vec2.Make(0,0));
  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2PolygonShape();
  fix_def.density = 80;
  fix_def.friction = 10;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;
  fix_def.shape.SetAsArray(vertex_list,3);

  body.CreateFixture(fix_def);
}

function cw_createChassis(vertex_list) { //alap építés
  var body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0.0, 5.0);

  var body = world.CreateBody(body_def);

  cw_createChassisPart(body, vertex_list[0],vertex_list[1]);
  cw_createChassisPart(body, vertex_list[1],vertex_list[2]);
  cw_createChassisPart(body, vertex_list[2],vertex_list[3]);
  cw_createChassisPart(body, vertex_list[3],vertex_list[4]);
  cw_createChassisPart(body, vertex_list[4],vertex_list[5]);
  cw_createChassisPart(body, vertex_list[5],vertex_list[6]);
  cw_createChassisPart(body, vertex_list[6],vertex_list[7]);
  cw_createChassisPart(body, vertex_list[7],vertex_list[0]);
// 0-7 szög alap
  body.vertex_list = vertex_list;

  return body;
}

function cw_createWheel(radius, density) {
  var body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0, 0);

  var body = world.CreateBody(body_def);

  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2CircleShape(radius);
  fix_def.density = density;
  fix_def.friction = 1;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;

  body.CreateFixture(fix_def);
  return body;
}

function cw_createRandomCar() {
  var v2;
  var car_def = new Object();
  //--------------érték adás
		//kerék
  car_def.wheel_radius1 = Math.random()*wheelMaxRadius+wheelMinRadius;
  car_def.wheel_radius2 = Math.random()*wheelMaxRadius+wheelMinRadius;
  car_def.wheel_density1 = Math.random()*wheelMaxDensity+wheelMinDensity;
  car_def.wheel_density2 = Math.random()*wheelMaxDensity+wheelMinDensity;
		//alap
  car_def.vertex_list = new Array();
  car_def.vertex_list.push(new b2Vec2(Math.random()*chassisMaxAxis + chassisMinAxis,0));
  car_def.vertex_list.push(new b2Vec2(Math.random()*chassisMaxAxis + chassisMinAxis,Math.random()*chassisMaxAxis + chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(0,Math.random()*chassisMaxAxis + chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(-Math.random()*chassisMaxAxis - chassisMinAxis,Math.random()*chassisMaxAxis + chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(-Math.random()*chassisMaxAxis - chassisMinAxis,0));
  car_def.vertex_list.push(new b2Vec2(-Math.random()*chassisMaxAxis - chassisMinAxis,-Math.random()*chassisMaxAxis - chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(0,-Math.random()*chassisMaxAxis - chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(Math.random()*chassisMaxAxis + chassisMinAxis,-Math.random()*chassisMaxAxis - chassisMinAxis));

  car_def.wheel_vertex1 = Math.floor(Math.random()*8)%8; // kerékben lévő vonal (sebesség mutatás)
  v2 = car_def.wheel_vertex1;
  //nincs 2 kerék egy ponton
  while(v2 == car_def.wheel_vertex1) {
    v2 = Math.floor(Math.random()*8)%8
  }
  car_def.wheel_vertex2 = v2;

  return car_def;
}

/* === END Car ============================================================= */
/* ========================================================================= */

/* ========================================================================= */
/* ==== Floor ============================================================== */

function cw_createFloor() {
  var last_tile = null;
  var tile_position = new b2Vec2(-15,0);
  minimapfogdistance = 0;
  fogdistance.width = "800px";
  minimapctx.clearRect(0,0,minimapcanvas.width,minimapcanvas.height);
  minimapctx.strokeStyle = "#000";
  minimapctx.beginPath();
  minimapctx.moveTo(0,35 * minimapscale);
  for(var k = 0; k < maxFloorTiles; k++) {
    last_tile = cw_createFloorTile(tile_position, (Math.random()*3 - 1.5) * 1.5*k/maxFloorTiles);
    cw_floorTiles.push(last_tile);
    last_fixture = last_tile.GetFixtureList();
    last_world_coords = last_tile.GetWorldPoint(last_fixture.GetShape().m_vertices[3]);
    tile_position = last_world_coords;
    minimapctx.lineTo((tile_position.x + 5) * minimapscale, (-tile_position.y + 35) * minimapscale);
  }
  minimapctx.stroke();
}



function cw_createFloorTile(position, angle) {
  body_def = new b2BodyDef();

  body_def.position.Set(position.x, position.y);
  var body = world.CreateBody(body_def);
  fix_def = new b2FixtureDef();
  fix_def.shape = new b2PolygonShape();
  fix_def.friction = 0.5;

  var coords = new Array();
  coords.push(new b2Vec2(0,0));
  coords.push(new b2Vec2(0,-groundPieceHeight));
  coords.push(new b2Vec2(groundPieceWidth,-groundPieceHeight));
  coords.push(new b2Vec2(groundPieceWidth,0));

  var center = new b2Vec2(0,0);

  var newcoords = cw_rotateFloorTile(coords, center, angle);

  fix_def.shape.SetAsArray(newcoords);

  body.CreateFixture(fix_def);
  return body;
}

function cw_rotateFloorTile(coords, center, angle) {
  var newcoords = new Array();
  for(var k = 0; k < coords.length; k++) {
    nc = new Object();
    nc.x = Math.cos(angle)*(coords[k].x - center.x) - Math.sin(angle)*(coords[k].y - center.y) + center.x;
    //nc.x = Math.cos(angle)*(coords[k].x - center.x) + Math.sin(angle)*(coords[k].y - center.y) + center.x;
    //nc.x = Math.sin(angle)*(coords[k].x - center.x) - Math.cos(angle)*(coords[k].y - center.y) + center.x;
    //nc.x = Math.sin(angle)*(coords[k].x - center.x) + Math.cos(angle)*(coords[k].y - center.y) + center.x;
	
    nc.y = Math.sin(angle)*(coords[k].x - center.x) + Math.cos(angle)*(coords[k].y - center.y) + center.y;
    //nc.y = Math.sin(angle)*(coords[k].x - center.x) - Math.cos(angle)*(coords[k].y - center.y) + center.y;
    //nc.y = Math.cos(angle)*(coords[k].x - center.x) + Math.sin(angle)*(coords[k].y - center.y) + center.y;
    //nc.y = Math.cos(angle)*(coords[k].x - center.x) - Math.sin(angle)*(coords[k].y - center.y) + center.y;
    newcoords.push(nc);
  }
  return newcoords;
}

/* ==== END Floor ========================================================== */
/* ========================================================================= */

/* ========================================================================= */
/* ==== Generation ========================================================= */

function cw_generationZero() {
  for(var k = 0; k < generationSize; k++) {
    var car_def = cw_createRandomCar();
    cw_carGeneration.push(car_def);
  }
  gen_counter = 0;
  document.getElementById("generation").innerHTML = "Generation: 0";
}

function cw_createNextCar() {
  car_health = max_car_health;
  cw_clearVelocityFIFO();
  document.getElementById("cars").innerHTML += "Car #"+(current_car_index+1)+": ";
  var newcar = new cw_Car(cw_carGeneration[current_car_index]);
  newcar.maxPosition = 0;
  newcar.maxPositiony = 0;
  newcar.minPositiony = 0;
  replay = ghost_create_replay();
  ghost_reset_ghost(ghost);
  ghost_add_replay_frame(replay, newcar);
  newcar.frames = 0;
  return newcar;
}

function cw_killCar() {
  if(typeof myCar !== 'undefined') {
    world.DestroyBody(myCar.chassis);
    world.DestroyBody(myCar.wheel1);
    world.DestroyBody(myCar.wheel2);
  }
}

function cw_clearVelocityFIFO() {
  for(var k = 0; k < maxVelocityFIFO; k++) {
    velocityFIFO[k] = 9999;
  }
}

function cw_nextGeneration() {
  var newGeneration = new Array();
  var newborn;
  cw_getChampions();
  cw_topScores.push({i:gen_counter,v:cw_carScores[0].v,x:cw_carScores[0].x,y:cw_carScores[0].y,y2:cw_carScores[0].y2});
  plot_graphs();
  for(var k = 0; k < gen_champions; k++) {
    newGeneration.push(cw_carGeneration[cw_carScores[k].i]);
  }
  for(k = gen_champions; k < generationSize; k++) {
    var parent1 = cw_getParents();
    var parent2 = parent1;
    while(parent2 == parent1) {
      parent2 = cw_getParents();
    }
    newborn = cw_makeChild(cw_carGeneration[parent1],cw_carGeneration[parent2]);
    newborn = cw_mutate(newborn);
    newGeneration.push(newborn);
  }
  cw_carScores = new Array();
  cw_carGeneration = newGeneration;
  gen_counter++;
  document.getElementById("generation").innerHTML = "Generation: "+gen_counter;
  document.getElementById("cars").innerHTML = "";
}

function cw_getChampions() {
  var ret = new Array();
  cw_carScores.sort(function(a,b) {if(a.v > b.v) {return -1} else {return 1}});
  for(var k = 0; k < generationSize; k++) {
    ret.push(cw_carScores[k].i);
  }
  return ret;
}

function cw_getParents() {
  var parentIndex = -1;
  for(var k = 0; k < generationSize; k++) {
    if(Math.random() <= gen_parentality) {
      parentIndex = k;
      break;
    }
  }
  if(parentIndex == -1) {
    parentIndex = Math.round(Math.random()*(generationSize-1));
  }
  return parentIndex;
}

function cw_makeChild(car_def1, car_def2) {
  var newCarDef = new Object();
  swapPoint1 = Math.round(Math.random()*(nAttributes-1));
  swapPoint2 = swapPoint1;
  while(swapPoint2 == swapPoint1) {
    swapPoint2 = Math.round(Math.random()*(nAttributes-1));
  }
  var parents = [car_def1, car_def2];
  var curparent = 0;

  curparent = cw_chooseParent(curparent,0);
  newCarDef.wheel_radius1 = parents[curparent].wheel_radius1;
  curparent = cw_chooseParent(curparent,1);
  newCarDef.wheel_radius2 = parents[curparent].wheel_radius2;

  curparent = cw_chooseParent(curparent,2);
  newCarDef.wheel_vertex1 = parents[curparent].wheel_vertex1;
  curparent = cw_chooseParent(curparent,3);
  newCarDef.wheel_vertex2 = parents[curparent].wheel_vertex2;

  newCarDef.vertex_list = new Array();
  curparent = cw_chooseParent(curparent,4);
  newCarDef.vertex_list[0] = parents[curparent].vertex_list[0];
  curparent = cw_chooseParent(curparent,5);
  newCarDef.vertex_list[1] = parents[curparent].vertex_list[1];
  curparent = cw_chooseParent(curparent,6);
  newCarDef.vertex_list[2] = parents[curparent].vertex_list[2];
  curparent = cw_chooseParent(curparent,7);
  newCarDef.vertex_list[3] = parents[curparent].vertex_list[3];
  curparent = cw_chooseParent(curparent,8);
  newCarDef.vertex_list[4] = parents[curparent].vertex_list[4];
  curparent = cw_chooseParent(curparent,9);
  newCarDef.vertex_list[5] = parents[curparent].vertex_list[5];
  curparent = cw_chooseParent(curparent,10);
  newCarDef.vertex_list[6] = parents[curparent].vertex_list[6];
  curparent = cw_chooseParent(curparent,11);
  newCarDef.vertex_list[7] = parents[curparent].vertex_list[7];

  curparent = cw_chooseParent(curparent,12);
  newCarDef.wheel_density1 = parents[curparent].wheel_density1;
  curparent = cw_chooseParent(curparent,13);
  newCarDef.wheel_density2 = parents[curparent].wheel_density2;

  return newCarDef;
}

function cw_mutate(car_def) {
  if(Math.random() < gen_mutation)
    car_def.wheel_radius1 = Math.random()*wheelMaxRadius+wheelMinRadius;
  if(Math.random() < gen_mutation)
    car_def.wheel_radius2 = Math.random()*wheelMaxRadius+wheelMinRadius;
  if(Math.random() < gen_mutation)
    car_def.wheel_vertex1 = Math.floor(Math.random()*8)%8;
  if(Math.random() < gen_mutation)
      car_def.wheel_vertex2 = Math.floor(Math.random()*8)%8;
  if(Math.random() < gen_mutation)
    car_def.wheel_density1 = Math.random()*wheelMaxDensity+wheelMinDensity;
  if(Math.random() < gen_mutation)
    car_def.wheel_density2 = Math.random()*wheelMaxDensity+wheelMinDensity;

  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(0,1,new b2Vec2(Math.random()*chassisMaxAxis + chassisMinAxis,0));
  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(1,1,new b2Vec2(Math.random()*chassisMaxAxis + chassisMinAxis,Math.random()*chassisMaxAxis + chassisMinAxis));
  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(2,1,new b2Vec2(0,Math.random()*chassisMaxAxis + chassisMinAxis));
  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(3,1,new b2Vec2(-Math.random()*chassisMaxAxis - chassisMinAxis,Math.random()*chassisMaxAxis + chassisMinAxis));
  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(4,1,new b2Vec2(-Math.random()*chassisMaxAxis - chassisMinAxis,0));
  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(5,1,new b2Vec2(-Math.random()*chassisMaxAxis - chassisMinAxis,-Math.random()*chassisMaxAxis - chassisMinAxis));
  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(6,1,new b2Vec2(0,-Math.random()*chassisMaxAxis - chassisMinAxis));
  if(Math.random() < gen_mutation)
      car_def.vertex_list.splice(7,1,new b2Vec2(Math.random()*chassisMaxAxis + chassisMinAxis,-Math.random()*chassisMaxAxis - chassisMinAxis));
  return car_def;
}

function cw_chooseParent(curparent, attributeIndex) {
  var ret;
  if((swapPoint1 == attributeIndex) || (swapPoint2 == attributeIndex)) {
    if(curparent == 1) {
      ret = 0;
    } else {
      ret = 1;
    }
  } else {
    ret = curparent;
  }
  return ret;
}

function cw_setMutation(mutation) {
  gen_mutation = parseFloat(mutation);
}

function cw_setEliteSize(clones) {
  gen_champions = parseInt(clones, 10);
}

/* ==== END Genration ====================================================== */
/* ========================================================================= */

/* ========================================================================= */
/* ==== Drawing ============================================================ */

function setZoom(){
	zoom = document.getElementById("zoom").value;
	document.getElementById("zoom_response").innerHTML = "Zoom: " + zoom + "%";
	
}
function setdefaultZoom(){
	zoom = defaultZoom;
	document.getElementById("zoom_response").innerHTML = "Zoom: " + zoom + "%";
	var zoomvalue = document.getElementById("zoom");
	zoomvalue.value = zoom;
	
}
function cw_drawScreen() {
  carPosition = myCar.getPosition();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(200-(carPosition.x*zoom), 200+(carPosition.y*zoom));
  ctx.scale(zoom, -zoom);
  cw_drawFloor();
  ghost_draw_frame(ctx, ghost);
  cw_drawCar();
  ctx.restore();
}

function cw_drawGhostReplay() {
  carPosition = ghost_get_position(ghost);
  showDistance(Math.round(carPosition.x*100)/100, Math.round(carPosition.y*100)/100);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(200-(carPosition.x*zoom), 200+(carPosition.y*zoom));
  ctx.scale(zoom, -zoom);
  ghost_draw_frame(ctx, ghost);
  ghost_move_frame(ghost);
  cw_drawFloor();
  ctx.restore();
}
////////////floordrawing
function cw_drawFloor() {
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#777";
  ctx.lineWidth = 1/zoom;
  ctx.beginPath();

  outer_loop:
  for(var k = Math.max(0,last_drawn_tile-55); k < cw_floorTiles.length; k++) {
    var b = cw_floorTiles[k];
    for (f = b.GetFixtureList(); f; f = f.m_next) {
      var s = f.GetShape();
      var shapePosition = b.GetWorldPoint(s.m_vertices[0]).x;
      if((shapePosition > (carPosition.x - 25)) && (shapePosition < (carPosition.x + 20))) {
        cw_VirtualPoly(b, s.m_vertices, s.m_vertexCount);
      }
      if(shapePosition > carPosition.x + 20) {
        last_drawn_tile = k;
        break outer_loop;
      }
    }
  }
  ctx.fill();
  ctx.stroke();
}

function cw_drawCar() {
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1/zoom+1;
  b = myCar.wheel1;
  for (f = b.GetFixtureList(); f; f = f.m_next) {
    var s = f.GetShape();
    var color = Math.round(255 - (255 * (f.m_density - wheelMinDensity)) / wheelMaxDensity).toString();
    var rgbcolor = "rgb("+color+","+color+","+color+")";
    cw_drawCircle(b, s.m_p, s.m_radius, b.m_sweep.a, rgbcolor);
  }
  b = myCar.wheel2;
  for (f = b.GetFixtureList(); f; f = f.m_next) {
    var s = f.GetShape();
    var color = Math.round(255 - (255 * (f.m_density - wheelMinDensity)) / wheelMaxDensity).toString();
    var rgbcolor = "rgb("+color+","+color+","+color+")";
    cw_drawCircle(b, s.m_p, s.m_radius, b.m_sweep.a, rgbcolor);
  }
  ctx.strokeStyle = "#c44";
  ctx.fillStyle = "#fdd";
  ctx.beginPath();
  var b = myCar.chassis;
  for (f = b.GetFixtureList(); f; f = f.m_next) {
    var s = f.GetShape();
    cw_VirtualPoly(b, s.m_vertices, s.m_vertexCount);
  }
  ctx.fill();
  ctx.stroke();
}
/////////////////////////////////hide
function cw_setSpeed(speed){
	speednum = parseInt(speed, 10);
	//document.getElementById("speed").innerHTML +=speednum;
	if(sim_speed==null){
		//hide = 0;
		//hiddenbutton = document.getElementById("hiddenbutton");
		//hiddenbutton.value = "Hide";
		toggleDisplay();
	}
}
function hidebutton(button) {
	if(hide != null){
		if(hide != 1) {
			button.value = "Show";
			hide = 1;
			sim_speed = 1;
		} else {
			button.value = "Hide";
			hide = 0;
			sim_speed = null;
		}
	if(hideback == null){toggleDisplay();}
  }
}
function toggleDisplay() {
	
  
  if(cw_paused) {
    return;
  }
  canvas.width = canvas.width;
  if(doDraw) {
    doDraw = false;
    clearInterval(cw_drawInterval);
    clearInterval(cw_runningInterval);
    cw_runningInterval = setInterval(simulationStep, 1); // simulate max speed 1000x per second when not drawing
  } else {
    doDraw = true;
    cw_drawInterval = setInterval(cw_drawScreen, Math.round(speednum/screenfps));
    clearInterval(cw_runningInterval);
    cw_runningInterval = setInterval(simulationStep, Math.round(speednum/box2dfps));
  }
}

function cw_VirtualPoly(body, vtx, n_vtx) {

  var p0 = body.GetWorldPoint(vtx[0]);
  ctx.moveTo(p0.x, p0.y);
  for (var i = 1; i < n_vtx; i++) {
    p = body.GetWorldPoint(vtx[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(p0.x, p0.y);
}

function cw_drawPoly(body, vtx, n_vtx) {
  ctx.beginPath();

  var p0 = body.GetWorldPoint(vtx[0]);
  ctx.moveTo(p0.x, p0.y);
  for (var i = 1; i < n_vtx; i++) {
    p = body.GetWorldPoint(vtx[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(p0.x, p0.y);

  ctx.fill();
  ctx.stroke();
}

function cw_drawCircle(body, center, radius, angle, color) {
  var p = body.GetWorldPoint(center);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, 2*Math.PI, true);

  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + radius*Math.cos(angle), p.y + radius*Math.sin(angle));

  ctx.fill();
  ctx.stroke();
}

/* ==== END Drawing ======================================================== */
/* ========================================================================= */


/* ========================================================================= */
/* ==== Graphs ============================================================= */

function cw_storeGraphScores() {
  cw_graphAverage.push(cw_average(cw_carScores));
  //cw_graphElite.push(cw_eliteaverage(cw_carScores));
  cw_graphTop.push(cw_carScores[0].v);
}

function cw_plotTop() {
  var graphsize = cw_graphTop.length;
  graphctx.strokeStyle = "#f00";
  graphctx.beginPath();
  graphctx.moveTo(0,0);
  for(var k = 0; k < graphsize; k++) {
    graphctx.lineTo(400*(k+1)/graphsize,cw_graphTop[k]);
  }
  graphctx.stroke();
}


function cw_plotAverage() {
  var graphsize = cw_graphAverage.length;
  graphctx.strokeStyle = "#00f";
  graphctx.beginPath();
  graphctx.moveTo(0,0);
  for(var k = 0; k < graphsize; k++) {
    graphctx.lineTo(400*(k+1)/graphsize,cw_graphAverage[k]);
  }
  graphctx.stroke();
}

function plot_graphs() {
  cw_storeGraphScores();
  cw_clearGraphics();
  cw_plotAverage();
  cw_plotTop();
  cw_listTopScores();
}



function cw_average(scores) {
  var sum = 0;
  for(var k = 0; k < generationSize; k++) {
    sum += scores[k].v;
  }
  return sum/generationSize;
}

function cw_clearGraphics() {
  graphcanvas.width = graphcanvas.width;
  graphctx.translate(0,graphheight);
  graphctx.scale(1,-1);
  graphctx.lineWidth = 1;
  graphctx.strokeStyle="#888";
  graphctx.beginPath();
  graphctx.moveTo(0,graphheight/2);
  graphctx.lineTo(graphwidth, graphheight/2);
  graphctx.moveTo(0,graphheight/4);
  graphctx.lineTo(graphwidth, graphheight/4);
  graphctx.moveTo(0,graphheight*3/4);
  graphctx.lineTo(graphwidth, graphheight*3/4);
  graphctx.stroke();
}

function cw_listTopScores() {
  var ts = document.getElementById("topscores");
  ts.innerHTML = "<b>Sort by score</b><br />";
  cw_topScores.sort(function(a,b) {if(a.v > b.v) {return -1} else {return 1}});
  for(var k = 0; k < Math.min(25,cw_topScores.length); k++) {
	  var speedts_u = Math.round(cw_topScores[k].v*100)/100;
	  var speedts_i = Math.round(cw_topScores[k].x*100)/100;
	  var speedts = speedts_u-speedts_i;
	  
	  var scorets = Math.round(cw_topScores[k].v*100)/100;
	  var distancets = Math.round(cw_topScores[k].x*100)/100;
	  
	  var fixedscorets = parseFloat(scorets).toFixed( 2 );
	  var fixeddistancets = parseFloat(distancets).toFixed( 2 );
	  var fixedspeedts = parseFloat(speedts).toFixed( 2 );
	  
	  var space = "";
	  var place = k+1;
	  var placefix;
	  var genfix;
	  
		if(place <= 9 ){
			placefix="0"+place;
		} else{
			placefix=place;
		}
	  var gen = cw_topScores[k].i;
		if(gen <= 9 ){
			genfix = gen+space; 
		} else{
			genfix=gen;
		}
	  
    //document.getElementById("topscores").innerHTML += "#"+(k+1)+": "+Math.round(cw_topScores[k].v*100)/100+" d:"+Math.round(cw_topScores[k].x*100)/100+" h:"+Math.round(cw_topScores[k].y2*100)/100+"/"+Math.round(cw_topScores[k].y*100)/100+"m (gen "+cw_topScores[k].i+")<br />";
    document.getElementById("topscores").innerHTML += "#"+placefix+": Gen "+genfix+" || "+fixedscorets+"pts || Dist: "+fixeddistancets+"m || Speed: "+fixedspeedts+"m/s <br />";
    //document.getElementById("topscores").innerHTML += "#"+(k+1)+": Gen "+cw_topScores[k].i+" || "+ Math.round(cw_topScores[k].v*100)/100+"pts || Dis: "+Math.round(cw_topScoresv[k].x*100)/100+"m || Speed: "+Math.round(cw_topScores[k].v*100)/100-Math.round(cw_topScores[k].x*100)/100+" m/s<br />";
  }
}

/* ==== END Graphs ========================================================= */
/* ========================================================================= */

function simulationStep() {
  world.Step(1/box2dfps, 20, 20);
  ghost_add_replay_frame(replay, myCar);
  ghost_move_frame(ghost);
  myCar.frames++;
  showDistance(Math.round(myCar.getPosition().x*100)/100, Math.round(myCar.getPosition().y*100)/100);
  cw_storeVelocity(Math.abs(myCar.chassis.GetLinearVelocity().x) + Math.abs(myCar.chassis.GetLinearVelocity().y));
  if(cw_checkDeath()) {
    cw_kill();
  }
}

function cw_kill() {
  var avgspeed = (myCar.maxPosition / myCar.frames) * box2dfps;
  var position = myCar.maxPosition;
  var score = position + avgspeed;
  document.getElementById("cars").innerHTML += Math.round(position*100)/100 + "m + " +" "+Math.round(avgspeed*100)/100+" m/s = "+ Math.round(score*100)/100 +"pts<br />";
  ghost_compare_to_replay(replay, ghost, score);
  cw_carScores.push({ i:current_car_index, v:score, s: avgspeed, x:position, y:myCar.maxPositiony, y2:myCar.minPositiony });
  current_car_index++;
  cw_killCar();
  if(current_car_index >= generationSize) {
    cw_nextGeneration();
    current_car_index = 0;
  }
  myCar = cw_createNextCar();
  last_drawn_tile = 0;
}

function cw_storeVelocity(velocity) {
  velocityIndex++;
  if(velocityIndex >= maxVelocityFIFO) {
    velocityIndex = 0;
  }
  velocityFIFO[velocityIndex] = velocity;
}

function cw_checkDeath() {
  // check health
  if(myCar.getPosition().y > myCar.maxPositiony) {
    myCar.maxPositiony = myCar.getPosition().y;
  }
  if(myCar.getPosition().y < myCar.minPositiony) {
    myCar.minPositiony = myCar.getPosition().y;
  }
  if(myCar.getPosition().x > myCar.maxPosition) {
    car_health = max_car_health;
    myCar.maxPosition = myCar.getPosition().x;
  } else {
    car_health--;
    if(car_health == 0) {
      return true;
    }
  }
  document.getElementById("health").innerHTML = "Health: " + car_health;

  // check speed
  var result = 0;
  for(var k = 0; k < maxVelocityFIFO; k++) {
    result += velocityFIFO[k];
  }
  if(result < deathSpeed*maxVelocityFIFO) {
    return true;
  } else {
    return false;
  }
}

function cw_resetPopulation() {
  document.getElementById("generation").innerHTML = "";
  document.getElementById("cars").innerHTML = "";
  document.getElementById("topscores").innerHTML = "";
  cw_clearGraphics();
  cw_carGeneration = new Array();
  cw_carScores = new Array();
  cw_topScores = new Array();
  cw_graphTop = new Array();
  cw_graphAverage = new Array();
  velocityFIFO = new Array();
  velocityIndex = 0;
  lastmax = 0;
  lastaverage = 0;
  swapPoint1 = 0;
  swapPoint2 = 0;
  cw_killCar();
  cw_clearVelocityFIFO()
  cw_generationZero();
  current_car_index = 0;
  myCar = cw_createNextCar();
  ghost = ghost_create_ghost();
}

function cw_resetWorld() {
  for (b = world.m_bodyList; b; b = b.m_next) {
    world.DestroyBody(b);
  }
  Math.seedrandom(document.getElementById("newseed").value);
  cw_createFloor();
  Math.seedrandom();
  cw_resetPopulation();
}

function cw_confirmResetWorld() {
  if(confirm('Really reset world?')) {
    cw_resetWorld();
  } else {
    return false;
  }
}

// ghost replay stuff

function cw_pauseSimulation() {
  cw_paused = true;
  clearInterval(cw_runningInterval);
  clearInterval(cw_drawInterval);
  old_last_drawn_tile = last_drawn_tile;
  last_drawn_tile = 0;
  ghost_pause(ghost);
}

function cw_resumeSimulation() {
  cw_paused = false;
  ghost_resume(ghost);
  last_drawn_tile = old_last_drawn_tile;
  cw_runningInterval = setInterval(simulationStep, Math.round(speednum/box2dfps));
  cw_drawInterval = setInterval(cw_drawScreen, Math.round(speednum/screenfps));
}

function cw_startGhostReplay() {
  if(!doDraw) {
    toggleDisplay();
  }
  cw_pauseSimulation();
  cw_ghostReplayInterval = 0;
}

function cw_stopGhostReplay() {
  clearInterval(cw_ghostReplayInterval);
  cw_ghostReplayInterval = null;
  cw_resumeSimulation();
}

function cw_toggleGhostReplay(button) {
  if(cw_ghostReplayInterval == null) {
	hide = null;
    cw_startGhostReplay();
    button.value = "Resume";
	
  } else {
	hide = 0;
	sim_speed = null;
	hiddenbutton = document.getElementById("hiddenbutton");
	hiddenbutton.value = "Hide";
    cw_stopGhostReplay();
    button.value = "Pause";
  }
}
// ghost replay stuff END
//reseting
function value_reset(){
	var mutations = document.getElementById("mutationrate");
	mutations.value = gen_mutation;
	
	var eliteDNA = document.getElementById("elitesize");
	eliteDNA.value = gen_champions;
	
	var simulationSpeed = document.getElementById("simulationspeed");
	simulationSpeed.value = speednum;
	
	var zoomvalue = document.getElementById("zoom");
	zoomvalue.value = zoom
} 
var oldrandom = Math.seedrandom();
cw_createFloor();
value_reset();
cw_resetPopulation();


cw_runningInterval = setInterval(simulationStep, Math.round(speednum/box2dfps));
cw_drawInterval = setInterval(cw_drawScreen, Math.round(speednum/screenfps));
