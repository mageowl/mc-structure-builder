function range(start, end) {
	return Array.from({ length: end - start }, (_x, i) => i + start);
}
const gridSize = 16;
const canvasSize = 256;
const borderWidth = 3;

// Elements
const palette = document.querySelector("#block-palette");
const toolbar = document.querySelector("#toolbar");
const canvas = document.querySelector("#canvas");
const search = document.querySelector("#search");

class Tool {
	constructor(
		name,
		mouseDownEvent = () => {},
		config = { preview: true, drag: true }
	) {
		this._mouseDown = mouseDownEvent.bind(this);
		this.config = config;
		this.data = config.varibles;
		this.name = name;
	}

	mouseDown(pos) {
		this._mouseDown(pos);
	}

	// Tools
	static BRUSH = new Tool("brush", function (clickPos) {
		structure[selectedLayer][clickPos.x][clickPos.y] = selectedBlock;
	});

	static ERASER = new Tool(
		"eraser",
		function (clickPos) {
			structure[selectedLayer][clickPos.x][clickPos.y] = "air";
		},
		{ preview: false, drag: true }
	);

	static RECT = new Tool(
		"rect",
		function (clickPos) {
			if (this.data.pos != null) {
				for (let x = this.data.pos.x; x < clickPos.x + 1; x++) {
					for (let y = this.data.pos.y; y < clickPos.y + 1; y++) {
						structure[selectedLayer][x][y] = selectedBlock;
					}
				}
				this.data.pos = null;
			} else {
				this.data.pos = clickPos;
			}
		},
		{
			varibles: {
				pos: null
			},
			preview: true,
			drag: false
		}
	);

	static BUCKET = new Tool(
		"bucket",
		function (clickPos) {
			let queue = [clickPos];
			let startBlock = structure[selectedLayer][clickPos.x][clickPos.y];
			let pos;
			const checkPos = (x, y) => {
				if (
					pos.x + x >= 0 &&
					pos.x + x <= canvasSize / gridSize - 1 &&
					pos.y + y >= 0 &&
					pos.y + y <= canvasSize / gridSize - 1 &&
					structure[selectedLayer][pos.x + x][pos.y + y] == startBlock
				) {
					queue.push({ x: pos.x + x, y: pos.y + y });
				}
			};

			if (startBlock == selectedBlock) return;

			while (queue.length) {
				pos = queue.pop();
				structure[selectedLayer][pos.x][pos.y] = selectedBlock;

				checkPos(-1, 0);
				checkPos(1, 0);
				checkPos(0, -1);
				checkPos(0, 1);
			}
		},
		{ drag: false, preview: true }
	);

	static CLEAR_BUCKET = new Tool(
		"bucket",
		function (clickPos) {
			let queue = [clickPos];
			let startBlock = structure[selectedLayer][clickPos.x][clickPos.y];
			let pos;
			const checkPos = (x, y) => {
				if (
					pos.x + x >= 0 &&
					pos.x + x <= canvasSize / gridSize - 1 &&
					pos.y + y >= 0 &&
					pos.y + y <= canvasSize / gridSize - 1 &&
					structure[selectedLayer][pos.x + x][pos.y + y] == startBlock
				) {
					queue.push({ x: pos.x + x, y: pos.y + y });
				}
			};

			if (startBlock == "air") return;

			while (queue.length) {
				pos = queue.pop();
				structure[selectedLayer][pos.x][pos.y] = "air";

				checkPos(-1, 0);
				checkPos(1, 0);
				checkPos(0, -1);
				checkPos(0, 1);
			}
		},
		{ drag: false }
	);
}

let selectedTool = Tool.BRUSH;

let structure = (() => {
	let grid = [];
	for (x in range(0, 16)) {
		let row = [];
		for (y in range(0, 16)) {
			let column = [];
			for (z in range(0, 16)) {
				column.push("air");
			}
			row.push(column);
		}
		grid.push(row);
	}
	return grid;
})();
let changeList = [fullCopy(structure)];
let undoList = [];
let selectedLayer = 0;

function pointerPosition(pos) {
	let rect = canvas.getBoundingClientRect();
	return {
		x: Math.floor((pos.clientX - (rect.left + borderWidth)) / 2 / gridSize),
		y: Math.floor((pos.clientY - (rect.top + borderWidth)) / 2 / gridSize)
	};
}

function renderLayer(layer, ctx, images) {
	ctx.clearRect(0, 0, canvasSize, canvasSize);

	for (x in range(0, 16)) {
		for (y in range(0, 16)) {
			let block = structure[layer][x][y];
			if (block != "air")
				ctx.drawImage(images[block], x * gridSize, y * gridSize);
		}
	}
}

let selectedBlock = null;
function selectBlock(el) {
	if (!el.classList.contains("selected")) {
		selectedBlock = el.name;
		for (i in palette.children) {
			if (i == "length") break;
			palette.children[i].classList.remove("selected");
		}
		el.classList.add("selected");
	} else {
		selectedBlock = null;
		el.classList.remove("selected");
	}
}

function fullCopy(arr) {
	const iterate = (a) => {
		if (typeof a == "object" && a.length) {
			let r = [];
			Array.from(a).forEach((i) => r.push(iterate(i)));
			return r;
		} else {
			return a;
		}
	};

	return iterate(arr);
}

function selectTool(tool) {
	selectedTool = tool;
	for (i in toolbar.children) {
		if (i == "length") break;
		toolbar.children[i].classList.remove("selected");
	}
	document
		.querySelector(`#toolbar a[name=${tool.name}`)
		.classList.add("selected");
}

let mouseDown = false;

fetch("blocks.json")
	.then((r) => r.json())
	.then((blockData) => {
		let blockImages = {};

		// Add blocks to palette
		Object.keys(blockData.blocks)
			.sort()
			.forEach((blockType) => {
				let el = document.createElement("li");
				el.name = blockType;
				el.onclick = () => selectBlock(el, palette);
				el.innerHTML = blockType;

				palette.appendChild(el);

				let img = new Image();
				img.src = "assets/blocks/" + blockData.blocks[blockType];
				blockImages[blockType] = img;
			});

		// Setup Canvas
		/**
		 * @type {HTMLCanvasElement}
		 */
		const ctx = canvas.getContext("2d");

		// Handle Mouse
		canvas.addEventListener("mousemove", (e) => {
			if (selectedBlock == null) return;

			let clickPos = pointerPosition(e);
			if (
				clickPos.x < 0 ||
				clickPos.y < 0 ||
				clickPos.x > canvasSize / gridSize ||
				clickPos.y > canvasSize / gridSize
			) {
				renderLayer(selectedLayer, ctx, blockImages);
				mouseDown = false;
				return;
			}

			if (mouseDown && selectedTool.config.drag) {
				selectedTool.mouseDown(clickPos);
				renderLayer(selectedLayer, ctx, blockImages);
			} else {
				renderLayer(selectedLayer, ctx, blockImages);
				if (selectedTool.config.preview)
					ctx.drawImage(
						blockImages[selectedBlock],
						clickPos.x * gridSize,
						clickPos.y * gridSize
					);
			}
		});

		canvas.addEventListener("mousedown", (e) => {
			mouseDown = true;

			if (selectedBlock == null) return;
			let clickPos = pointerPosition(e);
			if (
				clickPos.x < 0 ||
				clickPos.y < 0 ||
				clickPos.x > canvasSize / gridSize ||
				clickPos.y > canvasSize / gridSize
			)
				return;

			changeList.push(fullCopy(structure));
			undoList = [];
			selectedTool.mouseDown(clickPos);
			renderLayer(selectedLayer, ctx, blockImages);
		});

		canvas.addEventListener("mouseup", (e) => {
			mouseDown = false;
		});

		canvas.addEventListener("mouseover", () => {
			search.blur();
		});

		// Keyboard shortcuts
		search.addEventListener("keydown", (e) => {
			if (e.key == "Enter" || e.key == "Tab") {
				search.blur();
				selectBlock(palette.children[1]);
				e.preventDefault();
			}

			e.stopPropagation();
		});

		search.addEventListener("keyup", (e) => {
			// Remove children
			Array.from(palette.children).forEach((element) => {
				if (element != search) element.remove();
			});

			// Search
			Object.keys(blockData.blocks)
				.sort()
				.forEach((blockType) => {
					if (!blockType.includes(search.value)) return;

					let el = document.createElement("li");
					el.name = blockType;
					el.onclick = () => selectBlock(el, palette);
					el.innerHTML = blockType;

					palette.appendChild(el);

					let img = new Image();
					img.src = "assets/blocks/" + blockData.blocks[blockType];
					blockImages[blockType] = img;
				});
		});

		window.addEventListener("keydown", (e) => {
			switch (e.key.toLowerCase()) {
				// Tools
				case "b":
					selectTool(Tool.BRUSH);
					break;

				case "e":
					selectTool(Tool.ERASER);
					break;

				case "r":
					selectTool(Tool.RECT);
					break;

				case "g":
					if (e.shiftKey) selectTool(Tool.CLEAR_BUCKET);
					else selectTool(Tool.BUCKET);
					break;

				// Blocks
				case "arrowup":
				case "[":
					let current = palette.querySelector("li.selected");
					let index = Array.from(palette.children).indexOf(current);

					if (current != null && index != 1) {
						selectBlock(palette.children[index - 1]);
					} else if (palette.hasChildNodes()) {
						selectBlock(palette.children[palette.children.length - 1]);
					}

					break;

				case "arrowdown":
				case "]":
				case "tab":
					let currentBlock = palette.querySelector("li.selected");
					let blockIndex = Array.from(palette.children).indexOf(currentBlock);

					if (
						currentBlock != null &&
						blockIndex != palette.children.length - 1
					) {
						selectBlock(palette.children[blockIndex + 1]);
					} else if (palette.hasChildNodes()) {
						selectBlock(palette.children[1]);
					}

					e.preventDefault();

					break;

				// Search
				case "/":
					search.focus();
					e.preventDefault();

					break;

				// Undo/Redo
				case "z":
					if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
						if (changeList.length) {
							let change = changeList.pop();
							undoList.push(structure);
							structure = fullCopy(change);

							renderLayer(selectedLayer, ctx, blockImages);
						}
						e.preventDefault();
					} else if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
						if (undoList.length) {
							let change = undoList.pop();
							changeList.push(structure);
							structure = fullCopy(change);

							renderLayer(selectedLayer, ctx, blockImages);
						}
						e.preventDefault();
					}
			}
		});

		// Layers
		const layerSelect = document.querySelector("select#layer");
		layerSelect.addEventListener("change", () => {
			selectedLayer = parseInt(layerSelect.value);
			renderLayer(selectedLayer, ctx, blockImages);
		});
	});

function exportStructure() {
	let file = "";

	for (let x = 0; x < 16; x++) {
		for (let y = 0; y < 16; y++) {
			for (let z = 0; z < 16; z++) {
				let block = structure[z][x][y];
				if (block != "air" || document.querySelector("input#force-air").checked)
					file += `setblock ~${x} ~${y} ~${z} minecraft:${block}\n`;
			}
		}
	}

	var element = document.createElement("a");
	element.setAttribute(
		"href",
		"data:text/plain;charset=utf-8," + encodeURIComponent(file)
	);
	element.setAttribute("download", "structure.mcfunction");

	element.style.display = "none";
	document.body.appendChild(element);

	element.click();

	document.body.removeChild(element);
}
