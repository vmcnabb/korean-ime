(ime => {
    const Block = ime.composition.Block;
    const maps = ime.hangeulMaps;

    ime.converter = {
        romanize: function (hangeul) {
            var text = '';
            for (let i in hangeul) {
                const block = Block.fromChar(hangeul[i], false);
                text += block.initial == 'ㅇ' ? i < 1 || !(isHangeul(hangeul[i-1])) ? '' : '-' : 
                    (maps.hangeulRoman[block.initial] || block.initial);
                text += maps.hangeulRoman[block.medial[0]] || '';
                text += maps.hangeulRoman[block.medial[1]] || '';
                text += maps.hangeulRoman[block.final[0]] || '';
                text += maps.hangeulRoman[block.final[1]] || '';
            }
            return text;
        }
    }

    function isHangeul (char) {
        const cc = char.charCodeAt(0);
        return cc >= 0xAC00 && cc <= 0xD7A3;
    }
})(window.koreanIme);
