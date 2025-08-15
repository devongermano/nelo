import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';

export async function setupOpenAPI(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Nelo API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  writeFileSync(join(process.cwd(), 'openapi.json'), JSON.stringify(document, null, 2));

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/openapi.json', (req, res) => {
    res.json ? res.json(document) : res.send(document);
  });
}
