import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Public } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../common/decorators/auth.decorators';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published posts' })
  @ApiQuery({ name: 'category', required: false })
  findPublished(@Query('category') category?: string) {
    return this.postsService.findPublished({ category });
  }

  @Public()
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get published post by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findPublishedBySlug(slug);
  }

  @Get('admin/all')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List all posts (admin)' })
  findAllAdmin() {
    return this.postsService.findAllAdmin();
  }

  @Get('admin/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get post by id (admin)' })
  findOneAdmin(@Param('id') id: string) {
    return this.postsService.findOneAdmin(id);
  }

  @Post()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create post' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update post' })
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete post' })
  remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }
}
