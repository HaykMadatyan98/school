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
  CreateMenuItemDto,
  ReorderMenuDto,
  UpdateMenuItemDto,
} from '../pages/dto/page.dto';
import { MenuService } from './menu.service';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public nested menu tree' })
  findPublic() {
    return this.menuService.findPublicTree();
  }

  @Get('admin/tree')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Admin menu tree (includes hidden)' })
  findAdmin() {
    return this.menuService.findAdminTree();
  }

  @Get('admin/flat')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Flat menu list for parent picker' })
  findFlat() {
    return this.menuService.findAllFlat();
  }

  @Post()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create menu item' })
  create(@Body() dto: CreateMenuItemDto) {
    return this.menuService.create(dto);
  }

  @Patch('reorder')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Reorder menu items by id list' })
  reorder(@Body() dto: ReorderMenuDto) {
    return this.menuService.reorder(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update menu item' })
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menuService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete menu item' })
  remove(@Param('id') id: string) {
    return this.menuService.remove(id);
  }
}
