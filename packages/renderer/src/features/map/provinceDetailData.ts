export interface ProvinceDetailCard {
  provinceId: string;
  capitalName: string;
  imageSrc: string | null;
  imageAlt: string;
}

const DEFAULT_CAPITAL_IMAGE = "/images/capitals/capital-placeholder.svg";

const PROVINCE_DETAIL_DATA: Record<string, ProvinceDetailCard> = {
  "110000": { provinceId: "110000", capitalName: "北京", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "北京城市风景插画" },
  "120000": { provinceId: "120000", capitalName: "天津", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "天津城市风景插画" },
  "130000": { provinceId: "130000", capitalName: "石家庄", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "石家庄城市风景插画" },
  "140000": { provinceId: "140000", capitalName: "太原", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "太原城市风景插画" },
  "150000": { provinceId: "150000", capitalName: "呼和浩特", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "呼和浩特城市风景插画" },
  "210000": { provinceId: "210000", capitalName: "沈阳", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "沈阳城市风景插画" },
  "220000": { provinceId: "220000", capitalName: "长春", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "长春城市风景插画" },
  "230000": { provinceId: "230000", capitalName: "哈尔滨", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "哈尔滨城市风景插画" },
  "310000": { provinceId: "310000", capitalName: "上海", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "上海城市风景插画" },
  "320000": { provinceId: "320000", capitalName: "南京", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "南京城市风景插画" },
  "330000": { provinceId: "330000", capitalName: "杭州", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "杭州城市风景插画" },
  "340000": { provinceId: "340000", capitalName: "合肥", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "合肥城市风景插画" },
  "350000": { provinceId: "350000", capitalName: "福州", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "福州城市风景插画" },
  "360000": { provinceId: "360000", capitalName: "南昌", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "南昌城市风景插画" },
  "370000": { provinceId: "370000", capitalName: "济南", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "济南城市风景插画" },
  "410000": { provinceId: "410000", capitalName: "郑州", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "郑州城市风景插画" },
  "420000": { provinceId: "420000", capitalName: "武汉", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "武汉城市风景插画" },
  "430000": { provinceId: "430000", capitalName: "长沙", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "长沙城市风景插画" },
  "440000": { provinceId: "440000", capitalName: "广州", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "广州城市风景插画" },
  "450000": { provinceId: "450000", capitalName: "南宁", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "南宁城市风景插画" },
  "460000": { provinceId: "460000", capitalName: "海口", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "海口城市风景插画" },
  "500000": { provinceId: "500000", capitalName: "重庆", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "重庆城市风景插画" },
  "510000": { provinceId: "510000", capitalName: "成都", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "成都城市风景插画" },
  "520000": { provinceId: "520000", capitalName: "贵阳", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "贵阳城市风景插画" },
  "530000": { provinceId: "530000", capitalName: "昆明", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "昆明城市风景插画" },
  "540000": { provinceId: "540000", capitalName: "拉萨", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "拉萨城市风景插画" },
  "610000": { provinceId: "610000", capitalName: "西安", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "西安城市风景插画" },
  "620000": { provinceId: "620000", capitalName: "兰州", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "兰州城市风景插画" },
  "630000": { provinceId: "630000", capitalName: "西宁", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "西宁城市风景插画" },
  "640000": { provinceId: "640000", capitalName: "银川", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "银川城市风景插画" },
  "650000": { provinceId: "650000", capitalName: "乌鲁木齐", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "乌鲁木齐城市风景插画" },
  "710000": { provinceId: "710000", capitalName: "台北", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "台北城市风景插画" },
  "810000": { provinceId: "810000", capitalName: "香港", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "香港城市风景插画" },
  "820000": { provinceId: "820000", capitalName: "澳门", imageSrc: DEFAULT_CAPITAL_IMAGE, imageAlt: "澳门城市风景插画" },
};

export function getProvinceCapitalPlaceholder(provinceId: string): ProvinceDetailCard {
  return {
    provinceId,
    capitalName: "暂无省会图片",
    imageSrc: DEFAULT_CAPITAL_IMAGE,
    imageAlt: "暂无省会图片",
  };
}

export function getProvinceDetailCard(provinceId: string) {
  return PROVINCE_DETAIL_DATA[provinceId] ?? getProvinceCapitalPlaceholder(provinceId);
}
