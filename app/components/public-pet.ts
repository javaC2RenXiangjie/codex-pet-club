export type PublicPet = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  creatorId: string | null;
  version: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
  isOfficial: boolean;
};

export const categoryLabels: Record<string, string> = {
  character: "人物角色",
  animal: "动物伙伴",
  fantasy: "奇幻生物",
  robot: "机器人",
  other: "其他",
};
