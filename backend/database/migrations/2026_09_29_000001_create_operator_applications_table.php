<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operator_applications', function (Blueprint $table) {
            $table->id();
            $table->string('applicant_name');
            $table->string('company_name');
            $table->string('email');
            $table->string('phone');
            $table->string('quarry_location');
            $table->string('permit_number')->nullable();
            $table->text('remarks')->nullable();
            $table->string('document_path')->nullable();
            $table->string('document_original_name')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('admin_remarks')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operator_applications');
    }
};
