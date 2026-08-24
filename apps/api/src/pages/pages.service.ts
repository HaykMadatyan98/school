import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slugify';
import {
  normalizeAcademicYear,
  yearSortKey,
} from '../common/academic-year';
import { normalizeLocalized } from '../common/dto/localized-text.dto';
import {
  AddYearPageDto,
  CreatePageDto,
  UpdatePageDto,
} from './dto/page.dto';

function normalizeYearLabel(raw: string) {
  try {
    return normalizeAcademicYear(raw);
  } catch (err) {
    throw new BadRequestException(
      err instanceof Error ? err.message : 'Invalid year',
    );
  }
}

function titleAm(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'am' in value) {
    return String((value as { am?: string }).am || '');
  }
  return '';
}

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  findPublished() {
    return this.prisma.page.findMany({
      where: { status: PostStatus.PUBLISHED },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findPublishedBySlug(slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug, status: PostStatus.PUBLISHED },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async findPublishedYears(parentSlug: string) {
    const years = await this.prisma.page.findMany({
      where: {
        parentSlug,
        status: PostStatus.PUBLISHED,
        yearLabel: { not: null },
      },
    });
    return years.sort(
      (a, b) => yearSortKey(b.yearLabel) - yearSortKey(a.yearLabel),
    );
  }

  findAllAdmin() {
    return this.prisma.page.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findYearsAdmin(parentSlug: string) {
    const years = await this.prisma.page.findMany({
      where: { parentSlug },
    });
    return years.sort(
      (a, b) => yearSortKey(b.yearLabel) - yearSortKey(a.yearLabel),
    );
  }

  async findOneAdmin(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async create(dto: CreatePageDto) {
    const title = normalizeLocalized(dto.title);
    const content = normalizeLocalized(dto.content);
    const excerpt = dto.excerpt ? normalizeLocalized(dto.excerpt) : undefined;
    const base =
      dto.slug?.trim() ||
      slugify(title.am || 'page') ||
      'page';
    const slug = await this.uniqueSlug(base);
    const status = dto.status ?? PostStatus.DRAFT;
    return this.prisma.page.create({
      data: {
        title: title as unknown as Prisma.InputJsonValue,
        slug,
        excerpt: (excerpt as unknown as Prisma.InputJsonValue) ?? undefined,
        content: content as unknown as Prisma.InputJsonValue,
        coverImage: dto.coverImage,
        status,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        parentSlug: dto.parentSlug?.trim() || undefined,
        yearLabel: dto.yearLabel?.trim() || undefined,
      },
    });
  }

  async addYear(parentId: string, dto: AddYearPageDto) {
    const parent = await this.findOneAdmin(parentId);
    if (parent.parentSlug) {
      throw new BadRequestException('Cannot add a year under another year page');
    }
    const yearLabel = normalizeYearLabel(dto.yearLabel);
    const existing = await this.prisma.page.findFirst({
      where: { parentSlug: parent.slug, yearLabel },
    });
    if (existing) {
      throw new BadRequestException(`Year ${yearLabel} already exists`);
    }

    const parentTitle = titleAm(parent.title) || parent.slug;
    const status = dto.status ?? PostStatus.DRAFT;
    const slug = await this.uniqueSlug(`${parent.slug}-${yearLabel}`);

    return this.prisma.page.create({
      data: {
        title: { am: `${parentTitle} ${yearLabel}` } as unknown as Prisma.InputJsonValue,
        slug,
        content: {
          am: `## ${parentTitle} ${yearLabel}\n\n`,
        } as unknown as Prisma.InputJsonValue,
        status,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        parentSlug: parent.slug,
        yearLabel,
      },
    });
  }

  async update(id: string, dto: UpdatePageDto) {
    const existing = await this.findOneAdmin(id);
    const data: Prisma.PageUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = normalizeLocalized(
        dto.title,
      ) as unknown as Prisma.InputJsonValue;
    }
    if (dto.excerpt !== undefined) {
      if (!dto.excerpt) {
        data.excerpt = null;
      } else {
        const normalized = normalizeLocalized({
          am: dto.excerpt.am || '',
        });
        data.excerpt = normalized.am.trim()
          ? (normalized as unknown as Prisma.InputJsonValue)
          : null;
      }
    }
    if (dto.content !== undefined) {
      data.content = normalizeLocalized(
        dto.content,
      ) as unknown as Prisma.InputJsonValue;
    }
    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage;
    if (dto.slug !== undefined && dto.slug.trim()) {
      data.slug = await this.uniqueSlug(dto.slug.trim(), id);
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
    if (dto.parentSlug !== undefined) {
      data.parentSlug = dto.parentSlug?.trim() || null;
    }
    if (dto.yearLabel !== undefined) {
      const nextYear = dto.yearLabel
        ? normalizeYearLabel(dto.yearLabel)
        : null;
      data.yearLabel = nextYear;
      if (
        nextYear &&
        existing.yearLabel &&
        existing.yearLabel !== nextYear &&
        existing.slug.includes(existing.yearLabel) &&
        dto.slug === undefined
      ) {
        data.slug = await this.uniqueSlug(
          existing.slug.replace(existing.yearLabel, nextYear),
          id,
        );
      }
    }
    return this.prisma.page.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.page.delete({ where: { id } });
    return { ok: true };
  }

  private async uniqueSlug(base: string, excludeId?: string) {
    let slug = base;
    let i = 2;
    while (true) {
      const found = await this.prisma.page.findUnique({ where: { slug } });
      if (!found || found.id === excludeId) return slug;
      slug = `${base}-${i++}`;
    }
  }
}
