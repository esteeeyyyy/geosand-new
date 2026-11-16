<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quarry_operator', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quarry_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['quarry_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quarry_operator');
    }
};
