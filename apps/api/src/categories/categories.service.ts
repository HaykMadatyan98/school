import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeLocalized } from '../common/dto/localized-text.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яёəğıöüşç]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { slug: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const name = normalizeLocalized(dto.name);
    const description = dto.description
      ? normalizeLocalized(dto.description)
      : undefined;
    const slug =
      dto.slug || slugify(name.am || 'category');
    try {
      return await this.prisma.category.create({
        data: {
          name: name as object,
          slug,
          description: (description as object) ?? undefined,
        },
      });
    } catch {
      throw new ConflictException('Category with this slug already exists');
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name ? (normalizeLocalized(dto.name) as object) : undefined,
        slug: dto.slug,
        description: dto.description
          ? (normalizeLocalized(dto.description) as object)
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}
