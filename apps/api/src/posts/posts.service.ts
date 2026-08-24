import { Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeLocalized } from '../common/dto/localized-text.dto';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ё]/g, 'e')
    .replace(/[а-яəğıöüşç]/gi, (ch) => {
      const map: Record<string, string> = {
        а: 'a',
        б: 'b',
        в: 'v',
        г: 'g',
        д: 'd',
        е: 'e',
        ж: 'zh',
        з: 'z',
        и: 'i',
        й: 'y',
        к: 'k',
        л: 'l',
        м: 'm',
        н: 'n',
        о: 'o',
        п: 'p',
        р: 'r',
        с: 's',
        т: 't',
        у: 'u',
        ф: 'f',
        х: 'h',
        ц: 'ts',
        ч: 'ch',
        ш: 'sh',
        щ: 'sch',
        ъ: '',
        ы: 'y',
        ь: '',
        э: 'e',
        ю: 'yu',
        я: 'ya',
        ə: 'e',
        ğ: 'g',
        ı: 'i',
        ö: 'o',
        ü: 'u',
        ş: 'sh',
        ç: 'c',
      };
      return map[ch.toLowerCase()] ?? '';
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const postInclude = {
  author: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true, slug: true, description: true } },
} as const;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublished(params?: { category?: string }) {
    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
    };

    if (params?.category) {
      where.category = { slug: params.category };
    }

    return this.prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: { publishedAt: 'desc' },
    });
  }

  async findPublishedBySlug(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: PostStatus.PUBLISHED },
      include: postInclude,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  findAllAdmin() {
    return this.prisma.post.findMany({
      include: postInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOneAdmin(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async create(authorId: string, dto: CreatePostDto) {
    const title = normalizeLocalized(dto.title);
    const content = normalizeLocalized(dto.content);
    const excerpt = dto.excerpt ? normalizeLocalized(dto.excerpt) : undefined;
    const slug = await this.uniqueSlug(
      dto.slug || slugify(title.am || 'post'),
    );
    const status = dto.status ?? PostStatus.DRAFT;

    return this.prisma.post.create({
      data: {
        title: title as unknown as Prisma.InputJsonValue,
        slug,
        excerpt: (excerpt as unknown as Prisma.InputJsonValue) ?? undefined,
        content: content as unknown as Prisma.InputJsonValue,
        coverImage: dto.coverImage,
        images: dto.images ?? [],
        status,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        authorId,
        categoryId: dto.categoryId,
      },
      include: postInclude,
    });
  }

  async update(id: string, dto: UpdatePostDto) {
    const existing = await this.findOneAdmin(id);
    const data: Prisma.PostUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = normalizeLocalized(dto.title) as unknown as Prisma.InputJsonValue;
    }
    if (dto.excerpt !== undefined) {
      data.excerpt = dto.excerpt
        ? (normalizeLocalized(dto.excerpt) as unknown as Prisma.InputJsonValue)
        : (Prisma.JsonNull as unknown as Prisma.InputJsonValue);
    }
    if (dto.content !== undefined) {
      data.content = normalizeLocalized(
        dto.content,
      ) as unknown as Prisma.InputJsonValue;
    }
    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage;
    if (dto.images !== undefined) data.images = dto.images;
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.slug !== undefined) {
      data.slug = await this.uniqueSlug(dto.slug, id);
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (
        dto.status === PostStatus.PUBLISHED &&
        existing.status !== PostStatus.PUBLISHED
      ) {
        data.publishedAt = new Date();
      }
    }

    return this.prisma.post.update({
      where: { id },
      data,
      include: postInclude,
    });
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.post.delete({ where: { id } });
    return { ok: true };
  }

  private async uniqueSlug(base: string, excludeId?: string) {
    let slug = base || 'post';
    let i = 1;
    while (true) {
      const found = await this.prisma.post.findUnique({ where: { slug } });
      if (!found || found.id === excludeId) {
        return slug;
      }
      slug = `${base}-${i++}`;
    }
  }
}
