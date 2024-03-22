const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')
canvas.width = innerWidth
canvas.height = innerHeight

var FOV = .5 * Math.PI
var RES = 1
var lap = 1
var checkpoints = 0
var mousedown = false
var mousepos = {x: 0, y: 0}
var activeEditTile = 0
var startDir = 0
var lapCount = 3

var floor = 0
var sky = 2

//types- 0: asphalt, 1: mud
var floorTypes = [
    {
        friction: 1,
        color: "darkgrey"
},
{
        friction: .25,
        color: "rgb(92, 64, 51)"
},
{
    friction: 1.2,
    color: 'green'
}
]

var skyTypes = ['skyblue', 'navy', 'dimgrey']


var commonOffset = canvas.width / 2.5 / 10

var checkpointPositions = [] //continue here. Store the checkpoint positions in this list so that I can easily reactivate them

var menu = 1 //0: race, 1: level editor

var spriteSheet = new Image()
spriteSheet.src = 'spritesheet.png'

map = [ //0: Blank tile, 1: American Flag, 2: Normal Wall, -1: Start/Finish Line, -2/-3: Unclaimed/Claimed Checkpoint
    [2, 1, 1, 1, 2, 2, 2, 2, 2, 2], 
    [2, 0, 0, 0, 2, 2, 2, 2, 2, 2], 
    [2, 0, 0, 0, 2, 2, 0, 0, 0, 2], 
    [2, 0, 2, 0, 2, 2, 0, 0, 0, 2], 
    [2, 0, 2, -2, 2, 2, 0, 2, -2, 2], 
    [2, 0, 2, 0, 0, 0, 0, 2, 0, 2], 
    [2, 0, 2, 0, 0, 0, 0, 2, 0, 2], 
    [2, 0, 2, 2, 2, 2, 2, 2, 0, 2], 
    [2, 0, 0, 0, 0, 0, -1, 0, 0, 2], 
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
]


function changeMapSize(size)
{
    map = []
    for (var i = 0; i < size; i++)
    {
        map.push([])
        for (var j = 0; j < size; j++)
        {
            if (j == 0 || j == size - 1 || i == 0 || i == size - 1)
            {
                map[i].push(2)
            }
            else
            {
                map[i].push(0)
            }
        }
    }
    tileSize = (canvas.width * .25) / map.length
    ts = (canvas.width / 2.5) / map.length // editor tile size

}



tileSize = (canvas.width * .25) / map.length //NEVER round this value for calculations, it messes up the raycast function and makes the rays clip through corners
offsetNum = tileSize / 64

var ts = (canvas.width / 2.5) / map.length // editor tile size
var keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    shift: false,
}

class Player
{
    constructor()
    {
        this.x = 6 * tileSize + tileSize / 2
        this.y = 8 * tileSize + tileSize / 2
        this.speed = 0
        this.topSpeed = 480 / tileSize
        this.acceleration = 300 / tileSize
        this.turnSpeed = 25
        this.direction = Math.PI * 1.5
        this.radius = tileSize / 10
        this.previousX = 0
        this.previousY = 0
    }
    draw()
    {
        c.fillStyle = 'yellow'
        c.beginPath()
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        c.fill()

        c.beginPath()
        c.strokeStyle = 'yellow'
        c.lineWidth = tileSize / 10
        c.moveTo(this.x, this.y)
        c.lineTo(this.x + (-Math.sin(this.direction) * tileSize / 5), this.y + (Math.cos(this.direction) * tileSize / 5))
        c.stroke()

    }
    update()
    {
        this.topSpeed = .33 *  tileSize
        this.acceleration = .2 * tileSize
        this.radius = tileSize / 10
        if (keys.w == true)
        {
            this.speed += this.acceleration * dt * floorTypes[floor].friction
            if (this.speed > this.topSpeed)
            {
                this.speed = this.topSpeed
            }
            
        }
        else if (keys.s == true)
        {
            this.speed -= this.acceleration * dt / 2
            if (this.speed < -this.topSpeed / 2)
            {
                this.speed = -this.topSpeed / 2
            }
        }
        else if (keys.w != true)//neither forward nor back are pressed, lose speed gradually
        {
            if (this.speed > 0)
            {
                this.speed -= 20 * dt * floorTypes[floor].friction
            }
            else if (this.speed < 0)
            {
                this.speed += 20 * dt * floorTypes[floor].friction
            }

            if (Math.abs(this.speed) < .3)
            {
                this.speed = 0
            }
        }

        if (keys.a == true)
        {
            this.direction -= .1 * dt * this.turnSpeed
            if (this.speed > (1 / floorTypes[floor].friction) / 15 * floorTypes[floor].friction * floorTypes[floor].friction)
            {
                this.speed -= (1 / floorTypes[floor].friction) / 15 * floorTypes[floor].friction * floorTypes[floor].friction
            }
            if (this.direction < 0)
            {
                this.direction = 6.28
            }
        }
        if (keys.d == true)
        {
            this.direction += .1 * dt * this.turnSpeed
            if (this.speed > (1 / floorTypes[floor].friction) / 15 * floorTypes[floor].friction * floorTypes[floor].friction)
            {
                this.speed -= (1 / floorTypes[floor].friction) / 15 * floorTypes[floor].friction * floorTypes[floor].friction
            }
            if (this.direction > 6.28)
            {
                this.direction = 0
            }
        }
        if (keys.shift)
        {
            this.direction += .001 * dt * this.turnSpeed
            if (this.direction > 6.28)
            {
                this.direction = 0
            }
        }

        //player movement
        for (var i = 0; i < this.speed; i++)
        {
            this.x += -Math.sin(this.direction) * dt * 10
            

            let testX = Math.floor(this.x / (tileSize))
            let testY = Math.floor(this.y / (tileSize))
            if (map[testY][testX] > 0) //if the tile you are in is solid
            {
                c.fillStyle = 'red'
                c.fillRect(Math.floor(this.x / (tileSize)) * tileSize, Math.floor(this.y / (tileSize)) * tileSize, tileSize, tileSize)
                while(map[testY][testX] > 0)
                {
                    this.x -= -Math.sin(this.direction) * dt
                    testX = Math.floor(this.x / (tileSize))
                }
                this.speed -= .1
            
            }

            this.y += Math.cos(this.direction) * dt * 10

            testX = Math.floor(this.x / (tileSize))
            testY = Math.floor(this.y / (tileSize))
            if (map[testY][testX] > 0) //if the tile you are in is solid
            {
                c.fillStyle = 'red'
                c.fillRect(Math.floor(this.x / (tileSize)) * tileSize, Math.floor(this.y / (tileSize)) * tileSize, tileSize, tileSize)
                while(map[testY][testX] > 0)
                {
                    this.y -= Math.cos(this.direction) * dt
                    testY = Math.floor(this.y / (tileSize))
                }

                this.speed -= .1
            
            }
            

            if (map[testY][testX] == -2) //if the player is on an unclamied checkpoint, claim it and set the checkpoint as claimed
            {
                checkpoints++
                map[testY][testX] = -3
                checkpointPositions.push({x: testX, y: testY})
            }
            if (map[testY][testX] == -1 && checkpoints == 2) //if the player is on the finish line and they have all the checkpoints claimed
            {
                checkpoints = 0
                lap ++
                lFrame = 0
                shouldDecrease = false
                wFrame = 0
                checkpointPositions.forEach(cp =>{
                    map[cp.y][cp.x] = -2
                })
                checkpointPositions = []
            }
        }
    }
}

class Button
{
    constructor(x, y, width, height, text, color, hoverColor, fontColor, img = null)
    {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
        this.text = text
        this.defaultColor = color
        this.fontColor = fontColor
        this.hoverColor = hoverColor
        this.color = this.defaultColor
        this.img = img * 64 //delete this if I want to use something that doesn't have an offset of 64

        this.fontSize = this.findBestTextSize()
    }
    findBestTextSize()
    {
        let fontSize = 250
        c.font = fontSize.toString() + "px Arcade Normal"
        let textSize = c.measureText(this.text)
        while (textSize.width >= this.width - 10 || (textSize.actualBoundingBoxAscent - textSize.actualBoundingBoxDescent) >= this.height - 10)
        {
            fontSize--
            c.font = fontSize.toString() + "px Arcade Normal"
            textSize = c.measureText(this.text)
        }
        return fontSize
    }
    draw()
    {
        c.fillStyle = this.color
        c.fillRect(this.x, this.y, this.width, this.height)

        c.fillStyle = this.fontColor
        if (this.text != "")
        {
            c.fillStyle = 'black'
            c.font = this.fontSize / 2.2 + "px Arcade Normal"
            let textSize = c.measureText(this.text)
            let textHeight = textSize.actualBoundingBoxAscent - textSize.actualBoundingBoxDescent
            c.fillText(this.text, this.x + (this.width / 2) - (textSize.width / 2), this.y + (this.height / 2) + (textHeight / 2), this.width, this.height)
        }
        else
        {
            c.drawImage(spriteSheet, this.img + 1, 0, 62, 64, this.x + this.width / 10, this.y + this.height / 10, this.width - this.width / 5, this.height - this.height / 5)
        }
    }
    isClicked()
    {
        if (mousepos.x >= this.x && mousepos.x <= this.x + this.width && mousepos.y >= this.y && mousepos.y <= this.y + this.height)
        {
            this.color = this.hoverColor
            if (mousedown)
            {
                mousedown = false
                return true
            }
            
        }
        else
        {
            this.color = this.defaultColor
        }
        return false
    }
}


function intersectionOfLines(x_1, y_1, x_2, y_2, x_3, y_3, x_4, y_4)
{
    let x1 = x_1
    let y1 = y_1
    let x2 = x_2
    let y2 = y_2
    let x3 = x_3
    let y3 = y_3
    let x4 = x_4
    let y4 = y_4


    if (x1 == x2)//stops the slope from being undefined
    {
        x1 -= .0000001
    }
    if (x3 == x4)//stops the slope from being undefined
    {
        x3 -= .0000001
    }
    let slope1 = (y2 - y1) / (x2 - x1)
    let b1 = y1 - (slope1 * x1)
    let slope2 = (y4 - y3) / (x4 - x3)
    let b2 = y3 - (slope2 * x3)

    let deltaSlope = slope1 - slope2
    let deltaB = b2 - b1
    let intersectX = deltaB / deltaSlope
    let intersectY = (slope1 * intersectX) + b1
    return {
        x: intersectX,
        y: intersectY}
}
function lengthOfSegment(x1, y1, x2, y2)
{
    if (x2 < x1)
    {
        let t = x2
        x2 = x1
        x1 = t
    }
    if (y2 < y1)
    {
        let t = y2
        y2 = y1
        y1 = t
    }
    return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2))
}

function raycast(x, y, dir, i = 0, playerDir)
{
    let startX = x - -Math.sin(dir)
    let startY = y - Math.cos(dir)
    let tx = startX
    let ty = startY
    let direction = dir
    let columnx
    let columny
    let xIntCoords
    let yIntCoords
    
    let r = false //is player facing right
    let d = false //is player facing left
    let shouldExit = false
    let its = 0

    let returnCoords = {x: 0, y: 0, length: 0, idx: i, offset: 0, type: 0}

    if (direction < 0)
    {
        direction = 6.28 + direction
    }
    while(!shouldExit)
    {
        columnx = Math.floor((tx) / (tileSize))
        columny = Math.floor((ty) / (tileSize))

        r = false
        d = false
        if (direction >= Math.PI) //if facing right
        {
            columnx++
            r = true //if the player is facing right, the column is already correct because it is the same thing as the right of the current tile. I need this variable because if the player is facing left I have to subtract 1 from columnx so that it checks the right index on the map array
        }
        if (direction <= Math.PI * .5 || direction >= Math.PI * 1.5) //if facing down
        {
            columny++
            d = true //same thing as r, I don't feel like explaining it again here, just NEVER delete r or d
        }
        xIntCoords = intersectionOfLines(tx, ty, tx + -Math.sin(direction) * 2, ty + Math.cos(direction) * 2, columnx * tileSize -.00000001, 0, columnx * tileSize, 2) //find intersection of vertical line
        yIntCoords = intersectionOfLines(tx, ty, tx + -Math.sin(direction) * 2, ty + Math.cos(direction) * 2, 0, columny * tileSize, 1, columny * tileSize - .00000001) //find intersection of horizontal line
        
        let xMeasure = lengthOfSegment(tx, ty, xIntCoords.x, xIntCoords.y)
        let yMeasure = lengthOfSegment(tx, ty, yIntCoords.x, yIntCoords.y)
        if (xMeasure < yMeasure) //if the vertical intersection is closer than the horizontal intersection
        {
            if (map[Math.floor(xIntCoords.y / (tileSize))][columnx - !r] <= 0) //
            {
                tx = xIntCoords.x
                ty = xIntCoords.y
                if (direction <= Math.PI)
                {
                    tx -= .00001
                }
            }
            else
            {
                returnCoords.offset = (xIntCoords.y - (Math.floor(xIntCoords.y / (tileSize))) * tileSize)
                returnCoords.offset = (63 / tileSize) * (returnCoords.offset)
                if (direction <= Math.PI) //invert the texture so it is facing the correct direction
                {
                    returnCoords.offset = 0 + (63 - returnCoords.offset)
                }
                returnCoords.length = 4000 / lengthOfSegment(startX, startY, xIntCoords.x, xIntCoords.y) //I could add * Math.cos(deltaDirection) but I like the fisheye effect
                returnCoords.type = map[Math.floor(xIntCoords.y / (tileSize))][columnx - !r]
                shouldExit = true
            }
        }
        else if (yMeasure <= xMeasure) //if the horizontal intersection is closer than the vertical intersection
        {
            if (map[columny - !d][Math.floor(yIntCoords.x / (tileSize))] <= 0) //
            {
                tx = yIntCoords.x
                ty = yIntCoords.y
                if (direction <= Math.PI * .5 || direction >= Math.PI * 1.5)
                {
                    ty += .00001
                }
            }
            else
            {
                returnCoords.offset = (yIntCoords.x - (Math.floor(yIntCoords.x / (tileSize))) * tileSize)
                returnCoords.offset = (63 / tileSize) * (returnCoords.offset)
                if (direction <= Math.PI * .5 || direction >= Math.PI * 1.5) //invert the texture so it is facing the correct direction
                {
                    returnCoords.offset = 0 + (63 - returnCoords.offset)
                }
                returnCoords.length = 4000 / lengthOfSegment(startX, startY, yIntCoords.x, yIntCoords.y) //I could add * Math.cos(deltaDirection) but I like the fisheye effect
                returnCoords.type = map[columny - !d][Math.floor(yIntCoords.x / (tileSize))]
                shouldExit = true
            }
        }
        if (its > 100)
        {
            shouldExit = true
        }
        its++
    }
    returnCoords.length /=  1 / tileSize
    returnCoords.length /= 38.4
    return returnCoords
}

function drawMap()
{
    for (var i = 0; i < map.length; i++)
    {
        for (var j = 0; j < map.length; j++)
        {
            if (map[i][j] == 1)
            {
                c.fillStyle = 'blue'
            }
            else if (map[i][j] == 2)
            {
                c.fillStyle = 'white' 
            }
            else if (map[i][j] == 3)
            {
                c.fillStyle = 'brown'
            }
            else if (map[i][j] == -1)
            {
                c.fillStyle = 'limegreen'
            }
            else if (map[i][j] == -2)
            {
                c.fillStyle = 'yellow'
            }
            else
            {
                c.fillStyle = floorTypes[floor].color
            }
            c.fillRect(j * tileSize, i * tileSize, tileSize, tileSize)
            
            
        }
    }
}

function drawEditorMap()
{
    let ts = (canvas.width / 2.5) / map.length
    let ms = ts * map.length
    for (var i = 0; i < map.length; i++)
    {
        for (var j = 0; j < map.length; j++)
        {
            if (map[i][j] == 1)
            {
                c.fillStyle = 'blue'
            }
            else if (map[i][j] == 2)
            {
                c.fillStyle = 'white' 
            }
            else if (map[i][j] == 3)
            {
                c.fillStyle = 'brown'
            }
            else if (map[i][j] == -1)
            {
                c.fillStyle = 'limegreen'
            }
            else if (map[i][j] == -2)
            {
                c.fillStyle = 'yellow'
            }
            else
            {
                c.fillStyle = floorTypes[floor].color
            }
            c.fillRect(j * ts + canvas.width / 25, i * ts + canvas.height / 2 - ms / 2, ts, ts)
            if (map[i][j] == -1)
            {
                drawArrow(j * ts + canvas.width / 25 + ts / 2, i * ts + canvas.height / 2 - (ts * map.length) / 2 + ts / 2, ts - 2, startDir, 'black', 2)
            }
        }
    }
}
function editMap()
{
    if (checkpointPositions != []) //if some checkpoints are claimed, unclaim them
    {
        checkpointPositions.forEach(checkpoint =>{
            map[checkpoint.y][checkpoint.x] = -2
            
        })
        checkpointPositions = []
    }
    if (mousedown && mousepos.x >= 0 && mousepos.y >= 0 && (mousepos.x - canvas.width / 25) / ts <= map.length && (mousepos.y - (canvas.height / 2 - (ts * map.length) / 2)) / ts <= map.length)
    {
        let cpPos = []
        if (activeEditTile == -2)
        {
            
            for (var i = 0; i < map.length; i++)
            {
                for (var j = 0; j < map.length; j++)
                {
                    if (map[j][i] == -2)
                    {
                        cpPos.push({x: i, y: j})
                    }
                }
            }       
        }
        if (cpPos.length >= 2)
        {
            map[cpPos[0].y][cpPos[0].x] = 0
            mousedown = false
        }

        //stops the user from erasing the edge of the map, they can edit it, but not remove it
        if (activeEditTile == 0)
        {
            if (Math.floor((mousepos.x - canvas.width / 25) / ts) == 0 || Math.floor((mousepos.x - canvas.width / 25) / ts) == map.length - 1 || Math.floor((mousepos.y - (canvas.height / 2 - (ts * map.length) / 2)) / ts) == 0 || Math.floor((mousepos.y - (canvas.height / 2 - (ts * map.length) / 2)) / ts) == map.length - 1)
            {
                return;
            }
        }
        if (activeEditTile == -1)
        {
            for (var i = 0; i < map.length; i++)
            {
                for (var j = 0; j < map.length; j++)
                {
                    if (map[j][i] == -1)
                    {
                        map[j][i] = 0
                    }
                }
            }
        }
        map[Math.floor((mousepos.y - (canvas.height / 2 - (ts * map.length) / 2)) / ts)][Math.floor((mousepos.x - canvas.width / 25) / ts)] = activeEditTile

    }
}

player = new Player()

editorWallButtons = [new Button(canvas.width / 2 + canvas.width / 8, canvas.height / 10, commonOffset, commonOffset, "", "white", "grey", "", 0), new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 1.5, canvas.height / 10, commonOffset, commonOffset, "", "white", "grey", "", 1), new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 3, canvas.height / 10, commonOffset, commonOffset, "", "white", "grey", "", 2)]

editorSpecialButtons = [new Button(canvas.width / 2 + canvas.width / 8, canvas.height / 10 * 2 + commonOffset / 2, commonOffset, commonOffset, "CP", "yellow", "gold", ""), new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 1.5,canvas.height / 10 * 2 + commonOffset / 2, commonOffset, commonOffset, "Finish", "lime", "green", ""), , new Button(canvas.width / 2 + canvas.width / 8 + 2 * commonOffset * 1.5, canvas.height / 10 * 2 + commonOffset / 2, commonOffset, commonOffset, "Eraser", "red", "crimson", "")]

editorFloorButtons = [new Button(canvas.width / 2 + canvas.width / 8, canvas.height / 10 * 3 + commonOffset / 2, commonOffset, commonOffset, "Asphalt", "darkgrey", "grey", ""), new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 1.5, canvas.height / 10 * 3 + commonOffset / 2, commonOffset, commonOffset, "Mud", "saddlebrown", "rgb(92, 61, 30)", ""), new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 3, canvas.height / 10 * 3 + commonOffset / 2, commonOffset, commonOffset, "Slime", "green", "forestgreen", "")]

editorSkyButtons = [new Button(canvas.width / 2 + canvas.width / 8, canvas.height / 10 * 4 + commonOffset / 2, commonOffset, commonOffset, "Day", "lightblue", "skyblue", ""), new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 1.5, canvas.height / 10 * 4 + commonOffset / 2, commonOffset, commonOffset, "Night", "darkblue", "navy", ""), new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 3, canvas.height / 10 * 4 + commonOffset / 2, commonOffset, commonOffset, "Stormy", "gray", "dimgray", "")]

mapSizeButton = new Button(canvas.width / 2 + canvas.width / 8, canvas.height - canvas.height / 10 - commonOffset, commonOffset * 2, commonOffset, "Change Map Size", 'white', "grey", "black", 0)

changeLapCount = new Button(canvas.width / 2 + canvas.width / 8 + commonOffset * 3, canvas.height - canvas.height / 10 - commonOffset, commonOffset * 2, commonOffset, "Change Lap Count", 'white', "grey", "black", 0)

toggleStartDir = new Button(canvas.width / 2 + canvas.width / 8, canvas.height - canvas.height / 5 - commonOffset, commonOffset * 2, commonOffset, "Change Start Dir", 'lime', "green", "black", 0)


var ct = Date.now()
var dt
var pt = ct

function drawFPS()
{
    c.fillStyle = 'red'
    c.font = "30px Arcade Normal"
    let width = c.measureText("FPS: " + Math.floor(1 / dt).toString()).width
    c.fillText("FPS: " + Math.floor(1 / dt).toString(), canvas.width - width - canvas.width / 64, canvas.width / 32)
}
function drawSpeed()
{
    c.fillStyle = 'black'
    c.fillRect(canvas.width / 100, canvas.height - canvas.height / 100 - 100, 100, 100)
    c.fillStyle = 'yellow'
    c.font = "30px Arcade Normal"
    let width = c.measureText(Math.floor(player.speed * 10).toString()).width / 1
    c.fillText(Math.floor(player.speed * 10).toString(), canvas.width / 100 + 100 / 2 - width / 2,  canvas.height - canvas.height / 100 - 100 + 60)
}

function drawArrow(x, y, length, dir, color, width)
{
    c.lineWidth = width
    c.strokeStyle = color
    c.beginPath()
    c.moveTo(x - (.5 * length * -Math.sin(dir)), y - (.5 * length * Math.cos(dir)))
    c.lineTo(x + (.5 * length * -Math.sin(dir)), y + (.5 * length * Math.cos(dir)))
    c.stroke()

    c.beginPath()
    c.moveTo(x + (.5 * length * -Math.sin(dir)), y + (.5 * length * Math.cos(dir)))
    c.lineTo(x - (Math.cos(dir) * length / 2), y - Math.sin(dir) * length / 2)
    c.stroke()

    c.beginPath()
    c.moveTo(x + (.5 * length * -Math.sin(dir)), y + (.5 * length * Math.cos(dir)))
    c.lineTo(x + (Math.cos(dir) * length / 2), y + Math.sin(dir) * length / 2)
    c.stroke()
}

var lFrame = 0
var shouldDecrease = false
var wFrame = 0
function drawLap()
{
    //canvas.height / 16 use that for the max y pos
    c.fillStyle = 'black'
    c.fillRect(canvas.width / 2 - canvas.width / 8, lFrame, canvas.width / 4, canvas.height / 8)
    c.fillStyle = 'yellow'
    c.font = (canvas.width / 40).toString() + "px Arcade Normal"
    let w = c.measureText("Lap: " + lap.toString() + "/" + lapCount.toString())
    let hDif = w.actualBoundingBoxAscent - w.actualBoundingBoxDescent
    c.fillText("Lap: " + lap.toString() + "/" + lapCount.toString(), canvas.width / 2 - w.width / 2, lFrame + canvas.height / 8 - hDif / 2 - canvas.width / 100)
    if (lFrame <= canvas.height / 16 && !shouldDecrease)
    {
        lFrame += 200 * dt
    }
    if (lFrame >= canvas.height / 17 || shouldDecrease)
    {
        
        if (shouldDecrease)
        {
            lFrame -= 200 * dt
        }
        else if (wFrame >= 1)
        {
            
            shouldDecrease = true
        }
        wFrame += dt
    }
}
function raycastScreen()
{
    posList = []
    let scanlines = canvas.width / RES
    let dir = player.direction - FOV / 2
    if (dir < 0)
    {
        dir = 6.28 + dir //dir will be negative so you just have to add
    }
    for (var i = 0; i < scanlines; i++)
    {
        posList.push(raycast(player.x, player.y, dir, i, player.direction))
        
        dir += FOV / scanlines
        if (dir > 6.28)
        {
            dir = 0 + dir - 6.28
        }
        if (dir < 0)
        {
            dir = 6.28 + dir //dir will be negative so you just have to add
        }
    }
    posList.sort((a, b) =>{
        a.length - b.length
    })
    posList.forEach(ray =>{

        c.drawImage(spriteSheet, ray.offset + ((ray.type - 1) * 64), 0, 1, 64, ray.idx * RES, canvas.height / 2 - ray.length, RES, 2 * ray.length)

    })

}

function beginRace()
{
    //reset lap variables
    lFrame = 0
    shouldDecrease = false
    wFrame = 0
    lap = 1

    //reset player variables
    for (var i = 0; i < map.length; i++)
    {
        for (var j = 0; j < map.length; j++)
        {
            if (map[i][j] == -1) //if tile is finish line
            {
                player.x = j * tileSize + tileSize / 2
                player.y = i * tileSize + tileSize / 2
                i = map.length
                j = map.length
            }
        }
    }
    player.speed = 0
    player.direction = startDir

    menu = 0
}

function saveLevel()
{
    output = ""
    output += (map.length.toString()) + "|" //add map size
    output += (floor.toString()) + "|"
    output += (sky.toString()) + "|"
    output += (lapCount.toString()) + "|"
    output += (startDir.toString()) + "|"
    output += map.toString() + "," //*add the comma to stop the load script from getting stuck looking for the last comma
    console.log(output)

    navigator.clipboard.writeText(output)
    localStorage.setItem('map', output)
    return output
}

function loadLevel()
{
    var code = localStorage.getItem('map')
    console.log(code)
    if (code == null)
    {
        alert("No Map has been saved into memory, please save a map before trying to load one")
        return
    }
    let i = 0
    let mapLength = ""
    let floorType = ""
    let skyType = ""
    let lapNum = ""
    let startingDir = ""
    let newMap = []
    while(code[i] != "|")
    {
        mapLength += code[i]
        i++
    }
    console.log(mapLength)
    i++
    while(code[i] != "|")
    {
        floorType += code[i]
        i++
    }
    console.log(floorType)
    i++
    while(code[i] != "|")
    {
        skyType += code[i]
        i++
    }
    console.log(skyType)

    i++
    while(code[i] != "|")
    {
        lapNum += code[i]
        i++
    }
    console.log(lapNum)

    i++
    while(code[i] != "|")
    {
        startingDir += code[i]
        i++
    }
    console.log(startingDir)

    i++
    let previ = i
    for (var j = 0; j < mapLength; j++)
    {
        newMap.push([])
        for (var k = 0; k < mapLength; k++)
        {
            let newNum = ""
            while (code[i] != ",") // *noted above, comma is added for this loop
            {
                i++
            }
            for (var l = 0; l < i - previ; l++) //loop for the length of the number
            {
                newNum += code[l + previ]
            }
            newMap[j].push(parseInt(newNum))
            
            i++
            previ = i
        }
    }
    
    for (var j = 0; j < mapLength; j++)
    {
        console.log(newMap[j])
    }


    map = newMap
    floor = parseInt(floorType)
    sky = parseInt(skyType)
    lapCount = parseInt(lapNum)
    startDir = parseFloat(startingDir)
    
    
}

function animate()
{
    ct = Date.now()
    dt = (ct - pt) / 1000
    c.clearRect(0, 0, canvas.width, canvas.height)
    
    requestAnimationFrame(animate)

    if (menu == 0)
    {
        c.fillRect(0, 0, canvas.width, canvas.height)
        c.fillStyle = skyTypes[sky]
        c.fillRect(0, 0, canvas.width, canvas.height / 2)
        c.fillStyle = floorTypes[floor].color
        c.fillRect(0, canvas.height / 2, canvas.width, canvas.height)
        
    
        
        player.update()
    
    
        raycastScreen()
    
        drawMap()
        player.draw()
    
        drawLap()
        drawFPS()
        drawSpeed()
        
        if (lap > lapCount)
        {
            menu = 1
        }
    }
    else if (menu == 1)
    {
        c.clearRect(0, 0, canvas.width, canvas.height)
        c.fillStyle = skyTypes[sky]
        c.fillRect(0, 0, canvas.width, canvas.height)
        drawEditorMap()
        editorWallButtons.forEach(button =>{
            button.draw()
            if (button.isClicked())
            {
                activeEditTile = (button.img / 64) + 1
            }
        })
        i = 0
        editorFloorButtons.forEach(button =>{
            button.draw()
            if (button.isClicked())
            {
                floor = i
                
            }
            i++
        })
        i = 0
        editorSkyButtons.forEach(button =>{
            button.draw()
            if (button.isClicked())
            {
                sky = i
                
            }
            i++
        })
        editorSpecialButtons.forEach(button =>{
            button.draw()
            if (button.isClicked())
            {
                if (button.text == 'CP')
                {
                    activeEditTile = -2
                }
                else if (button.text == 'Finish')
                {
                    activeEditTile = -1
                }
                else if (button.text == "Eraser")
                {
                    activeEditTile = 0
                }
                
            }
        })
        mapSizeButton.draw()
        if (mapSizeButton.isClicked())
        {
            changeMapSize(parseInt(prompt("Enter New Map Size: ")))
        }
        changeLapCount.draw()
        if (changeLapCount.isClicked())
        {
            lapCount = parseInt(prompt("Enter New Number of Laps (1-10): "))
            if (lapCount < 1)
            {
                lapCount = 1
            }
            if (lapCount > 10)
            {
                lapCount = 10
            }
        }
        toggleStartDir.draw()
        if (toggleStartDir.isClicked())
        {
            startDir += Math.PI / 4
            if (startDir > Math.PI * 2)
            {
                startDir = 0
            }
            mousedown = false
        }
        editMap()
    }
    
    pt = ct
}
animate()

document.onkeydown = function(e)
{
    if (e.key == 'w' || e.key == 'ArrowUp')
    {
        keys.w = true
    }
    if (e.key == 's' || e.key == 'ArrowDown')
    {
        keys.s = true
    }
    if (e.key == 'a' || e.key == 'ArrowLeft')
    {
        keys.a = true
    }
    if (e.key == 'd' || e.key == 'ArrowRight')
    {
        keys.d = true
    }
    if (e.key == "Shift")
    {
        keys.shift = true
        changeMapSize(10)
    }
    if (e.key == "e")
    {
        if (menu == 1)
        {
            beginRace()
        }
        else
        {
            menu = 1
        }
    }
    if (e.key == "r") //resets the race
    {
        if (menu == 0)
        {
            beginRace()
        }
    }
    if (e.key == "p") //resets the race
    {
        saveLevel()
    }
    if (e.key == "l") //resets the race
    {
        loadLevel()
    }
}
document.onkeyup = function(e)
{
    if (e.key == 'w' || e.key == 'ArrowUp')
    {
        keys.w = false
    }
    if (e.key == 's' || e.key == 'ArrowDown')
    {
        keys.s = false
    }
    if (e.key == 'a' || e.key == 'ArrowLeft')
    {
        keys.a = false
    }
    if (e.key == 'd' || e.key == 'ArrowRight')
    {
        keys.d = false
    }
    if (e.key == "Shift")
    {
        keys.shift = false
    }
}

document.onmousemove = function(e)
{
    mousepos.x = e.pageX
    mousepos.y = e.pageY
}
document.onmousedown = function(e)
{
    mousedown = true
}
document.onmouseup = function(e)
{
    mousedown = false
}