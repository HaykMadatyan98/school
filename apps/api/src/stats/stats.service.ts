import { Injectable } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [users, posts, published, drafts, categories, pages, menuItems] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.post.count(),
        this.prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
        this.prisma.post.count({ where: { status: PostStatus.DRAFT } }),
        this.prisma.category.count(),
        this.prisma.page.count(),
        this.prisma.menuItem.count(),
      ]);

    const recentPosts = await this.prisma.post.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        slug: true,
      },
    });

    return {
      users,
      posts,
      published,
      drafts,
      categories,
      pages,
      menuItems,
      recentPosts,
    };
  }
}
