export type CityVisitState = "unrecorded" | "wishlist" | "visited";

export interface CityWorkbenchCopy {
  visitState: CityVisitState;
  badge: string;
  title: string;
  description: string;
}

export function getCityWorkbenchCopy(
  visitState: CityVisitState | null | undefined,
  tripCount: number,
): CityWorkbenchCopy {
  const normalizedState: CityVisitState =
    tripCount > 0 ? "visited" : visitState ?? "unrecorded";

  if (normalizedState === "wishlist") {
    return {
      visitState: "wishlist",
      badge: "想去",
      title: "先把灵感和攻略收进来",
      description: "你可以先导入图片、PDF 和文档，之后再整理成某次旅行。",
    };
  }

  if (normalizedState === "visited") {
    return {
      visitState: "visited",
      badge: "去过",
      title: "继续补充这座城市的记录",
      description: "从旅行、本地资料和地标三个入口继续完善你的城市档案。",
    };
  }

  return {
    visitState: "unrecorded",
    badge: "未记录",
    title: "开始这座城市的第一条记录",
    description: "大多数城市都会从这里开始：先记一次旅行，或先导入一点本地资料。",
  };
}
