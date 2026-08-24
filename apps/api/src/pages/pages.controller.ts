import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/auth.decorators';
import {
  AddYearPageDto,
  CreatePageDto,
  UpdatePageDto,
} from './dto/page.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published pages' })
  findPublished() {
    return this.pagesService.findPublished();
  }

  @Public()
  @Get('years/:parentSlug')
  @ApiOperation({ summary: 'List published year pages under a section' })
  findYears(@Param('parentSlug') parentSlug: string) {
    return this.pagesService.findPublishedYears(parentSlug);
  }

  @Public()
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get published page by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.pagesService.findPublishedBySlug(slug);
  }

  @Get('admin/all')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List all pages (admin)' })
  findAllAdmin() {
    return this.pagesService.findAllAdmin();
  }

  @Get('admin/:id/years')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List year pages under this section (admin)' })
  async findYearsAdmin(@Param('id') id: string) {
    const page = await this.pagesService.findOneAdmin(id);
    return this.pagesService.findYearsAdmin(page.slug);
  }

  @Get('admin/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get page by id (admin)' })
  findOneAdmin(@Param('id') id: string) {
    return this.pagesService.findOneAdmin(id);
  }

  @Post()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create page' })
  create(@Body() dto: CreatePageDto) {
    return this.pagesService.create(dto);
  }

  @Post(':id/years')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Add academic year under a section page' })
  addYear(@Param('id') id: string, @Body() dto: AddYearPageDto) {
    return this.pagesService.addYear(id, dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update page' })
  update(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.pagesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete page' })
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}
