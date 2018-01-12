// Copyright © 2009-2012 Vincent McNabb

// Hangeul Editor
// Created: 29 May 2009 

// Romanization
// Created: 9 April 2012

var Map = function(one, two) {
		let error = "one and two must be equal length arrays, and one can contain no duplicates";
		if(one.length != two.length) throw error;
		
		for(var i in one) {
			if(this[one[i]]) throw error;
			this[one[i]] = two[i];
		}
	},
	TwoWayMap = function(one, two) {
		const error = "one and two must be equal length arrays with no values common between them";
		if(one.length != two.length) throw error;
		
		for(let i in one) {
			if(this[one[i]] || this[two[i]]) throw error;
		
			this[one[i]] = two[i];
			this[two[i]] = one[i];
		}
	},
	Jamo = function (i, m, f) {
		return {
			initial: i || '',
			medial: m || '',
			final: f || ''
		};
	},
	HangeulMappings = function() {
		const initials = this.initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
			medials = this.medials =  "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
			finals = this.finals =   "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

		this.qwertyHangeul = new Map(
			"QqWwEeRrTtYyUuIiOoPp" +
			"AaSsDdFfGgHhJjKkLl" +
			"ZzXxCcVvBbNnMm",	
			"ㅃㅂㅉㅈㄸㄷㄲㄱㅆㅅㅛㅛㅕㅕㅑㅑㅒㅐㅖㅔ" +
			"ㅁㅁㄴㄴㅇㅇㄹㄹㅎㅎㅗㅗㅓㅓㅏㅏㅣㅣ" +
			"ㅋㅋㅌㅌㅊㅊㅍㅍㅠㅠㅜㅜㅡㅡ"
		)
		
		this.hangeulRoman = new Map(
			"ㅃㅂㅉㅈㄸㄷㄲㄱㅆㅅㅛㅕㅑㅒㅐㅖㅔ" +
			"ㅁㄴㅇㄹㅎㅗㅓㅏㅣ" +
			"ㅋㅌㅊㅍㅠㅜㅡ" +
			"ㅘㅙㅚㅝㅞㅟㅢ",
			['bb','b','jj','j','dd','d','kk','g','ss','s','yo','yeo','ya','yae','ae','ye','e',
			'm','n','ng','r','h','o','eo','a','i',
			'k','t','ch','p','yu','u','eu',
			'wa','wae','oe','wo','we','wi','ui'
			]
		)
			
		const compoundVowels = this.compoundVowels = new TwoWayMap(
			["ㅗㅏ","ㅗㅐ","ㅗㅣ","ㅜㅓ","ㅜㅔ","ㅜㅣ","ㅡㅣ"],
			"ㅘㅙㅚㅝㅞㅟㅢ"
		);

		const consonantDigraphs = this.consonantDigraphs = new TwoWayMap(
			[
				"ㄱㅅ", "ㄴㅈ", "ㄴㅎ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ",
				"ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅂㅅ"
			],
			"ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ"
		)

		// Jamo to Unicode character formula: (initial)×588 + (medial)×28 + (final) + 44032
		this.constructJamo = jamo => {
			const a = initials.indexOf(jamo.initial),
				b = jamo.medial.length == 1 ?
						medials.indexOf(jamo.medial) :
						medials.indexOf(compoundVowels[jamo.medial]),
				c = (jamo.final.length == 1 ?
						finals.indexOf(jamo.final) :
						finals.indexOf(consonantDigraphs[jamo.final])) + 1;
			
			if(a > -1 && b >-1) {
				return String.fromCharCode(a * 588 + b * 28 + c + 44032);
				
			} else if(jamo.initial.length == 1) {
				return jamo.initial;
				
			} else {
				return compoundVowels[jamo.initial] || consonantDigraphs[jamo.initial];
			}
		};

		this.deconstructJamo = (char, separateDigraphs) => {
			let z = char.charCodeAt(0) - 44032;
			
			if(z < 0) return new Jamo(char);
			
			let a = ~~(z / 588);
			z -= a * 588;
			let b = ~~(z / 28);
			z -= b * 28;
			let c = z - 1;
			
			return new Jamo(
				initials[a],
				(separateDigraphs ? compoundVowels[medials[b]] : null) || medials[b],
				(separateDigraphs ? consonantDigraphs[finals[c]] : null) || finals[c]
			);
		};
	},
	SelectionEditor = function (element) {
		var selected;
		const replace = this.replace = function(text) {
			if(element.selectionStart != undefined) {
				const start = element.selectionStart;
				let end = element.selectionEnd;
				element.value = element.value.substring(0, start) +
					text +
					element.value.substring(end, element.value.length);
				end = start + text.length;
				element.selectionStart = start;
				element.selectionEnd = end;
				selection = { start, end };
	
			} else {
				const selection = element.ownerDocument.getSelection();
				const range = selection.getRangeAt(0);
				
				range.deleteContents();
				range.insertNode(document.createTextNode(text));
				selection.removeAllRanges();
				selection.addRange(range);
				selected = { range, selection };
			}
		}
	
		const deselect = this.deselect = function() {
			if (element.selectionStart != undefined) {
				element.selectionStart = element.selectionEnd;
	
			} else if (selected) {
				selected.range.collapse(false);
				selected.selection.removeAllRanges();
				selected.selection.addRange(selected.range);
				selected = undefined;
			}
		}

		this.restore = () => {
			if (selected) {
				// [contenteditable]
				// fix Gmail Compose selection bug on first key
				const selection = element.ownerDocument.getSelection();
				selection.removeAllRanges();
				selection.addRange(selected.range);
			}
		};
	
		var insert = this.insert = function(text) {
			replace(text);
			deselect();
		};
	},
	HangeulEditor = function (element) {
		const inputStates = {
			"Hangeul" : 1,
			"initial" : 2,
			"medial" : 3,
			"final" : 4
		};

		let inputState = inputStates.Hangeul,
			isHooked = false,
			jamo = new Jamo();
			
		const maps = new HangeulMappings(),
			sel = new SelectionEditor(element),
			constructed = (oldJamo, newJamo) => {
				return {
					"oldJamo": oldJamo,
					"newJamo": newJamo
				}
			},
			resetState = () => {
				jamo = new Jamo();
				inputState = inputStates.Hangeul;
			},		
			constructInitial = h => {
				var r,
					combined = jamo.initial + h;
				
				inputState = inputStates.initial;
				
				if(maps.compoundVowels[combined] || maps.consonantDigraphs[combined] || !jamo.initial) { // (V)V or (C)C or C or V, or nothing
					jamo.initial = combined;
					r = constructed("", maps.constructJamo(jamo));
				
				} else if(maps.initials.indexOf(jamo.initial) > -1 && maps.medials.indexOf(h) > -1) { // (C)+V
					r = constructMedial(h);
						
				} else if(maps.consonantDigraphs[jamo.initial] && maps.medials.indexOf(h) > -1) { // (CC)+V
					r = constructed(jamo.initial[0], "");
					jamo.initial = jamo.initial[1];
					r.newJamo = constructMedial(h).newJamo;
						
				} else { // (CC|C)C or (VV|V)[VC]
					r = constructed(maps.constructJamo(jamo), h);
					jamo.initial = h;
				}
				
				return r;
			},
			// is only called when a valid initial already exists
			constructMedial = h => {
				var combined = jamo.medial + h;
				var r;
				var isMedial = (maps.medials.indexOf(h) > -1);	
				
				inputState = inputStates.medial;
				
				//initial = (C)
				if((!jamo.medial && isMedial) || maps.compoundVowels[combined]) { // (C)+V or (C+V)V
					jamo.medial += h;
					r = constructed("", maps.constructJamo(jamo));
					
				} else if(maps.medials.indexOf(h) > -1) { // (C+V)+V or (C+VV)+V
					r = constructed(maps.constructJamo(jamo), "");
					resetState();
					r.newJamo = constructInitial(h).newJamo;

				} else { // (C+V)+C or (C+VV)+C
					r = constructFinal(h);
				}
				
				return r;
			},
			// called only when valid medial exists, i.e. (C+V) or (C+VV)
			constructFinal = h => {
				var r; var combined = jamo.final + h;

				inputState = inputStates.final;
				
				if((!jamo.final && maps.finals.indexOf(h) > -1) || maps.consonantDigraphs[combined]) {
					jamo.final += h; //(C+[V or VV])+[C or CC]
					r = constructed("", maps.constructJamo(jamo));

				} else if(jamo.final && maps.medials.indexOf(h) > -1) { 
					// if this is a vowel, take last consonant and create new character
					combined = jamo.final[jamo.final.length - 1];
					jamo.final = (jamo.final.length > 1) ? jamo.final[0] : "";

					r = constructed(maps.constructJamo(jamo), "");
					resetState();
					constructInitial(combined);
					r.newJamo = constructMedial(h).newJamo;

				} else {
					r = constructed(maps.constructJamo(jamo), "");
					resetState();
					r.newJamo = constructInitial(h).newJamo;
				}
				
				return r;
			},
			keyFn = {
				1: constructInitial,
				2: constructInitial,
				3: constructMedial,
				4: constructFinal
			},
			construct = h => keyFn[inputState](h),
			keyCodes = {
				A: 65,
				Z: 90,
				BkSp: 8,
				Shift: 16,
				Ctrl: 17,
				Alt: 18
			},
			eventHandlers = {
				keypress: event => {
					var cc = event.charCode || event.keyCode;
					
					if(!cc || event.ctrlKey) return true; // allows combinations like "ctrl-V" to work
					
					var key = maps.qwertyHangeul[String.fromCharCode(cc)];
					if(!key) {
						if(inputState > inputStates.Hangeul) sel.deselect();
						resetState();
						return true;
					}
	
					var r = construct(key);
					
					if(r.oldJamo.length > 0) {
						sel.insert(r.oldJamo);
					}	
					if(r.newJamo.length > 0) {
						sel.replace(r.newJamo);
					}
					
					console.log("Keypress");
					event.preventDefault();
					return false;
				},
				keyup: event => {
					sel.restore();
				},
				keydown: event => {
					var keycode = event.keyCode;
					
					if(inputState < inputStates.initial) {
						return true; //we're not editing a character so leave.
					}
					
					if(keycode >= keyCodes.A && keycode <= keyCodes.Z || keycode >= keyCodes.Shift && keycode <= keyCodes.Alt) { // alpha, Hangeul or shift key
						return true; //do nothing special
						
					} else if(keycode == keyCodes.BkSp) { // backspace
						// remove last jamo entered
						switch(inputState) {
							case inputStates.initial:
								if(jamo.initial.length == 2) {
									jamo.initial = jamo.initial[0];
								} else {
									resetState();
									return true;
								}
								break;
								
							case inputStates.medial:
								if(jamo.medial.length == 2) {
									jamo.medial = jamo.medial[0];
								} else {
									jamo.medial = "";
									inputState = inputStates.initial;
								}
								break;
								
							case inputStates.final:
								if(jamo.final.length == 2) {
									jamo.final = jamo.final[0];
								} else {
									jamo.final = "";
									inputState = inputStates.medial;
								}
								break;
						}
						sel.replace(maps.constructJamo(jamo));
	
						event.preventDefault();
						return false;
						
					} else {
						resetState();
						sel.deselect();
						return true;		
					}
				},
				blur: () => resetState(),
				mousedown: () => resetState()
			},
			listeners = [],
			add = (event, fn) => {
				element.addEventListener(event,fn,true);
				listeners.push({'event':event,'fn':fn,bool:true});
			};

		return {
			hook: () => {
				if(isHooked) return false;
				Object.keys(eventHandlers).forEach(key => add(key, eventHandlers[key]));
				return isHooked = true;
			},
			unhook: () => {
				if(!element) return false;
				
				resetState();
				sel.deselect();
				
				while(listeners.length) {
					let h = listeners.pop();
					element.removeEventListener(h.event,h.fn,h.bool);
				}
	
				isHooked = false;
				return true;
			},
			isHooked: () => isHooked
		};
	},
	HangeulConverter = function() {
		const map = new HangeulMappings(),
			isHangeul = char => {
				const cc = char.charCodeAt(0);
				return cc >= 0xAC00 && cc <= 0xD7A3;
			};

		return {
			romanize: hangeul => {
				var text = '';
				for(let i in hangeul) {
					const jamo = map.deconstructJamo(hangeul[i], false);
					text += jamo.initial == 'ㅇ' ? i < 1 || !(isHangeul(hangeul[i-1])) ? '' : '-' : 
						(map.hangeulRoman[jamo.initial] || jamo.initial);
					text += map.hangeulRoman[jamo.medial[0]] || '';
					text += map.hangeulRoman[jamo.medial[1]] || '';
					text += map.hangeulRoman[jamo.final[0]] || '';
					text += map.hangeulRoman[jamo.final[1]] || '';
				}
				return text;
			}
		};
	};
