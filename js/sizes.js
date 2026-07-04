/* ============================================================
   证件照制作网站 - 尺寸与配置模块
   ============================================================ */

// 中国标准证件照尺寸（物理尺寸 mm，300dpi 像素换算）
// 换算公式: 像素 = mm / 25.4 * dpi
const ID_SIZES = [
  { id: 'xiao1',  name: '小一寸', width: 22, height: 32, unit: 'mm', dpi: 300, bgColor: '#FFFFFF', desc: '用于驾驶证、身份证等' },
  { id: 'one',    name: '一寸',   width: 25, height: 35, unit: 'mm', dpi: 300, bgColor: '#FFFFFF', desc: '用于证件、简历等' },
  { id: 'da1',    name: '大一寸', width: 33, height: 48, unit: 'mm', dpi: 300, bgColor: '#FFFFFF', desc: '用于护照、港澳通行证等' },
  { id: 'two',    name: '二寸',   width: 35, height: 49, unit: 'mm', dpi: 300, bgColor: '#FFFFFF', desc: '用于毕业证、学位证等' },
  { id: 'xiao2',  name: '小二寸', width: 35, height: 45, unit: 'mm', dpi: 300, bgColor: '#FFFFFF', desc: '用于一些特定证件' },
];

// 标准背景色
const BG_COLORS = [
  { name: '白色', color: '#FFFFFF', desc: '通用证件照' },
  { name: '蓝色', color: '#438EDB', desc: '毕业证、简历等' },
  { name: '红色', color: '#D9001B', desc: '保险、医保等' },
  { name: '浅蓝', color: '#A0D8F1', desc: '部分国家签证' },
  { name: '灰色', color: '#CCCCCC', desc: '部分证件' },
];

// 排版纸张
const PAPER_SIZES = [
  { id: '4x6',  name: '4×6英寸', width: 102, height: 152, unit: 'mm', dpi: 300 },
  { id: '5x7',  name: '5×7英寸', width: 127, height: 178, unit: 'mm', dpi: 300 },
  { id: 'a4',   name: 'A4',      width: 210, height: 297, unit: 'mm', dpi: 300 },
];

/**
 * mm 转像素
 */
function mmToPixel(mm, dpi = 300) {
  return Math.round(mm / 25.4 * dpi);
}

/**
 * 获取尺寸配置
 */
function getSizeById(id) {
  return ID_SIZES.find(s => s.id === id) || ID_SIZES[1];
}

/**
 * 获取纸张配置
 */
function getPaperById(id) {
  return PAPER_SIZES.find(p => p.id === id) || PAPER_SIZES[0];
}

// 暴露到全局
window.ID_SIZES = ID_SIZES;
window.BG_COLORS = BG_COLORS;
window.PAPER_SIZES = PAPER_SIZES;
window.mmToPixel = mmToPixel;
window.getSizeById = getSizeById;
window.getPaperById = getPaperById;
