import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeLocalized } from '../common/dto/localized-text.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMenuItemDto,
  ReorderMenuDto,
  UpdateMenuItemDto,
} from '../pages/dto/page.dto';

export type MenuTreeNode = {
  id: string;
  label: unknown;
  href: string;
  order: number;
  visible: boolean;
  openInNewTab: boolean;
  parentId: string | null;
  children: MenuTreeNode[];
};

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicTree(): Promise<MenuTreeNode[]> {
    const items = await this.prisma.menuItem.findMany({
      where: { visible: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return this.buildTree(items);
  }

  async findAdminTree(): Promise<MenuTreeNode[]> {
    const items = await this.prisma.menuItem.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return this.buildTree(items);
  }

  async findAllFlat() {
    return this.prisma.menuItem.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateMenuItemDto) {
    const order =
      dto.order ??
      (await this.nextOrder(dto.parentId === undefined ? null : dto.parentId));
    return this.prisma.menuItem.create({
      data: {
        label: normalizeLocalized(dto.label) as unknown as Prisma.InputJsonValue,
        href: dto.href?.trim() || '#',
        order,
        visible: dto.visible ?? true,
        openInNewTab: dto.openInNewTab ?? false,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateMenuItemDto) {
    await this.ensureExists(id);
    const data: Prisma.MenuItemUncheckedUpdateInput = {};
    if (dto.label !== undefined) {
      data.label = normalizeLocalized(
        dto.label,
      ) as unknown as Prisma.InputJsonValue;
    }
    if (dto.href !== undefined) data.href = dto.href.trim() || '#';
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.visible !== undefined) data.visible = dto.visible;
    if (dto.openInNewTab !== undefined) data.openInNewTab = dto.openInNewTab;
    if (dto.parentId !== undefined) data.parentId = dto.parentId;
    return this.prisma.menuItem.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.menuItem.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });
    await this.prisma.menuItem.delete({ where: { id } });
    return { ok: true };
  }

  async reorder(dto: ReorderMenuDto) {
    await Promise.all(
      dto.ids.map((id, index) =>
        this.prisma.menuItem.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
    return this.findAdminTree();
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  private async nextOrder(parentId: string | null | undefined) {
    const last = await this.prisma.menuItem.findFirst({
      where: { parentId: parentId ?? null },
      orderBy: { order: 'desc' },
    });
    return (last?.order ?? -1) + 1;
  }

  private buildTree(
    items: Array<{
      id: string;
      label: unknown;
      href: string;
      order: number;
      visible: boolean;
      openInNewTab: boolean;
      parentId: string | null;
    }>,
  ): MenuTreeNode[] {
    const map = new Map<string, MenuTreeNode>();
    for (const item of items) {
      map.set(item.id, { ...item, children: [] });
    }
    const roots: MenuTreeNode[] = [];
    for (const item of items) {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sortRec = (nodes: MenuTreeNode[]) => {
      nodes.sort((a, b) => a.order - b.order);
      nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }
}
