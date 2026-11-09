package com.bai.jiayan;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;

/** Native rendering of the original PWA launch design. All dimensions are in dp. */
final class StartupBackground extends Drawable {
    private final float density;
    private final Bitmap icon;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    StartupBackground(Context context) {
        density = context.getResources().getDisplayMetrics().density;
        icon = BitmapFactory.decodeResource(context.getResources(), R.drawable.app_icon);
    }
    private void text(Canvas canvas, String value, float y, float size, float spacing, int color, Typeface font) {
        paint.setColor(color);
        paint.setTextSize(size);
        paint.setTypeface(font);
        float width = paint.measureText(value) + spacing * (value.length() - 1);
        float x = (getBounds().width() / density - width) / 2;
        for (int i = 0; i < value.length(); i++) {
            String glyph = value.substring(i, i + 1);
            canvas.drawText(glyph, x, y, paint);
            x += paint.measureText(glyph) + spacing;
        }
    }
    @Override public void draw(Canvas canvas) {
        canvas.save();
        canvas.scale(density, density);
        float width = getBounds().width() / density, height = getBounds().height() / density;
        canvas.drawColor(Color.rgb(248, 240, 228));
        paint.setColor(Color.argb(71, 215, 187, 161));
        for (float x = 2.5f; x < width; x += 5) for (float y = 2.5f; y < height; y += 5) canvas.drawCircle(x, y, .6f, paint);
        float top = height * .48f - 99.25f, left = (width - 108) / 2;
        RectF mark = new RectF(left, top, left + 108, top + 108);
        paint.setColor(Color.argb(24, 166, 93, 66));
        canvas.drawRoundRect(new RectF(left - 5, top + 10, left + 113, top + 122), 36, 36, paint);
        canvas.save();
        android.graphics.Path clip = new android.graphics.Path();
        clip.addRoundRect(mark, 32, 32, android.graphics.Path.Direction.CW);
        canvas.clipPath(clip);
        paint.setColor(Color.WHITE);
        canvas.drawBitmap(icon, null, mark, paint);
        canvas.restore();
        text(canvas, "家宴", top + 161, 27, 5.4f, Color.rgb(101, 69, 55), Typeface.create("serif", Typeface.BOLD));
        text(canvas, "家的味道，日日有新意", top + 193, 11, 3.08f, Color.rgb(173, 139, 118), Typeface.DEFAULT);
        float footer = height - 42;
        text(canvas, "为每一顿家常饭", footer, 10, 1.5f, Color.rgb(188, 162, 142), Typeface.DEFAULT);
        float footWidth = paint.measureText("为每一顿家常饭") + 1.5f * 6;
        paint.setColor(Color.rgb(215, 194, 175));
        paint.setStrokeWidth(1);
        canvas.drawLine((width-footWidth)/2-34,footer-4,(width-footWidth)/2-12,footer-4,paint);
        canvas.drawLine((width+footWidth)/2+12,footer-4,(width+footWidth)/2+34,footer-4,paint);
        canvas.restore();
    }
    @Override public void setAlpha(int alpha) { }
    @Override public void setColorFilter(ColorFilter filter) { }
    @Override public int getOpacity() { return PixelFormat.OPAQUE; }
}
