FROM nginx:alpine

# Default configlarni tozalash
RUN rm /etc/nginx/conf.d/default.conf

# O'zimizning config va fayllarni nusxalash
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html/

# Permissions: Nginx o'qiy olishi uchun (403 xatosini oldini oladi)
RUN chmod -R 755 /usr/share/nginx/html && chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]